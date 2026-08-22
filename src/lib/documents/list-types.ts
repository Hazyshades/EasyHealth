export type DocumentListItem = {
  id: string;
  original_filename: string;
  status: string;
  processing_status: string;
  document_type: string;
  lab_name: string | null;
  observed_at: string | null;
  created_at: string;
  error_message: string | null;
  mime_type: string | null;
  file_kind: string | null;
  page_count: number | null;
  processing_version: string | null;
  processing_error: string | null;
  is_legacy: boolean;
  has_thumbnail: boolean;
  thumbnail_url: string | null;
  thumbnail_expires_in: number | null;
};

export type ListDocumentsQuery = {
  type?: string | null;
  eligibleOnly?: boolean;
};

export type ListDocumentsSuccess = {
  ok: true;
  documents: DocumentListItem[];
};

export type ListDocumentsFailure = {
  ok: false;
  status: number;
  error: string;
};

export type ListDocumentsResult = ListDocumentsSuccess | ListDocumentsFailure;
