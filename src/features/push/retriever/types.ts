/**
 * Represents the raw response structure for a page from the Confluence v2 API.
 */
export interface ConfluencePageResponse {
  /** Contains links related to the page, such as the web UI link. */
  _links?: {
    /** The URL to view the page in a web browser. */
    webui?: string;
  };
  /** The body of the page content. */
  body: {
    /** The content in Confluence's storage format (XML-based). */
    storage: {
      value: string;
    };
  };
  /** The timestamp when the page was created. */
  createdAt: string;
  /** The unique identifier of the page. */
  id: string;
  /** The title of the page. */
  title: string;
  /** Information about the page's version. */
  version: {
    /** The timestamp when this version was created. */
    createdAt: string;
    /** The version number. */
    number: number;
  };
}

/**
 * Represents a normalized Confluence document with essential information.
 */
export interface ConfluenceDocument {
  /** The content of the document, typically in storage format. */
  content: string;
  /** The unique identifier of the page. */
  id: string;
  /** The title of the page. */
  title: string;
  /** The timestamp of the last update. */
  updatedAt: string;
  /** The current version number of the page. */
  version: number;
  /** The public URL to view the page. */
  webUrl?: string;
}
