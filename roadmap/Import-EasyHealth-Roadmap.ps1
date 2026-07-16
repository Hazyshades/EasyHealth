param(
    [string]$Owner = "Hazyshades",
    [string]$Repo = "Hazyshades/EasyHealth",
    [int]$ProjectNumber = 1,
    [string]$IssuesFile = "$PSScriptRoot\EasyHealth_GitHub_Issues.json",
    [switch]$SkipProject,
    [switch]$NoAssignee
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' is not installed. Install GitHub CLI: https://cli.github.com/"
    }
}

Require-Command "gh"

$activeUser = (& gh api user --jq '.login' 2>$null | Select-Object -First 1)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$activeUser)) {
    throw "GitHub CLI has no working active account. Run: gh auth login -h github.com"
}
Write-Host "Authenticated as $activeUser." -ForegroundColor Green

if (-not $SkipProject) {
    & gh project view $ProjectNumber --owner $Owner --format json 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Project #$ProjectNumber is not accessible. Run: gh auth refresh -h github.com -s project"
    }
}

if (-not (Test-Path -LiteralPath $IssuesFile)) {
    throw "Issues file not found: $IssuesFile"
}

$rawJson = Get-Content -LiteralPath $IssuesFile -Raw -Encoding UTF8
$parsedJson = ConvertFrom-Json -InputObject $rawJson

# Windows PowerShell 5.1 can preserve a top-level JSON array as one nested
# Object[] when it is wrapped directly with @(...). Flatten it explicitly.
if ($null -eq $parsedJson) {
    throw "The issues JSON could not be parsed."
} elseif ($parsedJson -is [System.Array]) {
    $issues = @($parsedJson | ForEach-Object { $_ })
} elseif ($null -ne $parsedJson.PSObject.Properties['issues']) {
    $issues = @($parsedJson.issues | ForEach-Object { $_ })
} else {
    $issues = @($parsedJson)
}

if ($issues.Count -eq 0) {
    throw "The issues JSON contains no items."
}

$recordIndex = 0
foreach ($item in $issues) {
    # Records are GitHub exports keyed by issue `number`, not a custom `id`.
    $required = @('number', 'title', 'body', 'labels')
    foreach ($field in $required) {
        if ($null -eq $item -or $null -eq $item.PSObject.Properties[$field]) {
            $available = if ($null -eq $item) { '<null>' } else { @($item.PSObject.Properties.Name) -join ', ' }
            throw "Invalid issue record at index ${recordIndex}: required property '$field' is missing. Available properties: $available"
        }
    }
    $recordIndex++
}

function Get-RoadmapId([psobject]$Issue) {
    if ($Issue.title -match '^\[([A-Z]+-\d+)\]') { return $Matches[1] }
    return $null
}

# Detect duplicate roadmap IDs (e.g. two issues both titled `[EH-102]`) by
# deriving the ID from the title prefix. This is independent of the GitHub
# issue `number`, which only identifies the issue on GitHub.
$duplicateIds = @($issues | ForEach-Object { Get-RoadmapId $_ } | Where-Object { $_ } | Group-Object | Where-Object { $_.Count -gt 1 })
if ($duplicateIds.Count -gt 0) {
    throw "Duplicate roadmap IDs found: $((@($duplicateIds.Name) -join ', '))"
}

Write-Host "Loaded $($issues.Count) roadmap issues." -ForegroundColor Cyan

$allLabels = @(
    foreach ($issue in $issues) {
        foreach ($label in @($issue.labels)) {
            if (-not [string]::IsNullOrWhiteSpace([string]$label)) {
                [string]$label
            }
        }
    }
) | Sort-Object -Unique

# Idempotency is by GitHub issue `number`: if the issue already exists, skip
# creation. This keeps issues such as #63 (which intentionally has no roadmap
# ID prefix) from being re-created or mis-matched against another roadmap ID.
function Find-ExistingIssueUrl([int]$Number) {
    $url = (& gh issue view $Number --repo $Repo --json url --jq '.url' 2>$null)
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace([string]$url)) {
        return [string]$url
    }
}

foreach ($label in $allLabels) {
    try {
        & gh label create $label --repo $Repo --color "BFDADC" --description "EasyHealth roadmap" --force 1>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Could not create/update label '$label'."
        }
    } catch {
        Write-Warning "Could not create/update label '$label': $($_.Exception.Message)"
    }
}

$created = 0
$skipped = 0
$addedToProject = 0
$failed = 0

foreach ($issue in $issues) {
    Write-Host "Processing $($issue.number): $($issue.title)" -ForegroundColor Yellow

    try {
        $existingUrl = Find-ExistingIssueUrl -Number $issue.number

        if (-not [string]::IsNullOrWhiteSpace([string]$existingUrl)) {
            $url = [string]$existingUrl
            Write-Host "  Existing issue found, skipping creation: $url" -ForegroundColor DarkYellow
            $skipped++
        } else {
            $tmp = New-TemporaryFile
            try {
                Set-Content -LiteralPath $tmp.FullName -Value ([string]$issue.body) -Encoding UTF8
                $args = @('issue', 'create', '--repo', $Repo, '--title', [string]$issue.title, '--body-file', $tmp.FullName)
                if (-not $NoAssignee) {
                    $args += @('--assignee', '@me')
                }
                foreach ($label in @($issue.labels)) {
                    if (-not [string]::IsNullOrWhiteSpace([string]$label)) {
                        $args += @('--label', [string]$label)
                    }
                }

                $createOutput = @(& gh @args 2>&1)
                $createExitCode = $LASTEXITCODE
                $url = @($createOutput | Where-Object { ([string]$_).Trim() -match '^https://github\.com/[^/]+/[^/]+/issues/\d+/?$' } | Select-Object -First 1)
                if ($url.Count -gt 0) {
                    $url = [string]$url[0]
                } else {
                    # GitHub can create an issue but return a non-zero exit code.
                    # Confirm the result by its GitHub issue number before failing.
                    $url = Find-ExistingIssueUrl -Number $issue.number
                }
                if ([string]::IsNullOrWhiteSpace([string]$url)) {
                    $details = (@($createOutput | ForEach-Object { [string]$_ }) -join ' ').Trim()
                    throw "gh issue create failed for $($issue.number) (exit code $createExitCode). $details"
                }
                if ($createExitCode -ne 0) {
                    Write-Warning "gh reported an error after creating $($issue.number); the issue was recovered at $url."
                }
                Write-Host "  Created: $url" -ForegroundColor Green
                $created++
            } finally {
                Remove-Item -LiteralPath $tmp.FullName -Force -ErrorAction SilentlyContinue
            }
        }

        if (-not $SkipProject) {
            & gh project item-add $ProjectNumber --owner $Owner --url $url 1>$null 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  Added to Project #$ProjectNumber." -ForegroundColor Green
                $addedToProject++
            } else {
                Write-Warning "Could not add $($issue.number) to Project #$ProjectNumber. The issue itself is safe; rerun after checking the project scope."
            }
        }
    } catch {
        $failed++
        Write-Error "Failed $($issue.number): $($_.Exception.Message)" -ErrorAction Continue
    }
}

Write-Host ""
Write-Host "Import complete" -ForegroundColor Cyan
Write-Host "Created:           $created"
Write-Host "Already existed:  $skipped"
Write-Host "Project additions:$addedToProject"
Write-Host "Failed:            $failed"

if ($failed -gt 0) { exit 1 }
