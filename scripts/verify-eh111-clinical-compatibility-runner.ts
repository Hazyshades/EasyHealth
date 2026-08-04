process.env.SKIP_ENV_VALIDATION = "1";

import("./verify-eh111-clinical-compatibility").catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
