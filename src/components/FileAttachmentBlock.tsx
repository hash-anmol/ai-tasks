"use client";

// File attachment types we support
export interface FileAttachment {
  url: string;
  filename: string;
  type: "pdf" | "image" | "document" | "video" | "other";
}

// Parse file URLs from content
export function parseFileAttachments(content: string): FileAttachment[] {
  const attachments: FileAttachment[] = [];
  const urlRegex = /(https?:\/\/[^\s<>"\]]+\.(pdf|png|jpg|jpeg|gif|webp|doc|docx|xls|xlsx|ppt|pptx|txt|zip|mp3|mp4|mov|avi|webm|svg))/gi;
  const matches = content?.match(urlRegex);

  if (matches) {
    const seen = new Set<string>();
    for (const url of matches) {
      if (seen.has(url)) continue;
      seen.add(url);
      const ext = url.split(".").pop()?.toLowerCase() || "";
      let type: FileAttachment["type"] = "other";

      if (["pdf"].includes(ext)) type = "pdf";
      else if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) type = "image";
      else if (["doc", "docx", "txt", "xls", "xlsx", "ppt", "pptx"].includes(ext)) type = "document";
      else if (["mp4", "mov", "avi", "webm"].includes(ext)) type = "video";

      const filename = url.split("/").pop()?.split("?")[0] || "file";
      attachments.push({ url, filename, type });
    }
  }

  return attachments;
}

// Get icon for file type
function getFileIcon(type: FileAttachment["type"]): string {
  switch (type) {
    case "pdf": return "picture_as_pdf";
    case "image": return "image";
    case "document": return "description";
    case "video": return "videocam";
    default: return "attach_file";
  }
}

interface FileAttachmentBlockProps {
  attachments: FileAttachment[];
  /** Show inline image/video previews */
  showPreviews?: boolean;
  className?: string;
}

export default function FileAttachmentBlock({ attachments, showPreviews = true, className = "" }: FileAttachmentBlockProps) {
  if (attachments.length === 0) return null;

  const imageAttachments = attachments.filter(f => f.type === "image");
  const videoAttachments = attachments.filter(f => f.type === "video");
  const otherAttachments = attachments.filter(f => f.type !== "image" && f.type !== "video");

  return (
    <div className={`mt-3 pt-3 border-t border-[var(--border)] ${className}`}>
      {/* Inline image previews */}
      {showPreviews && imageAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {imageAttachments.map((file, i) => (
            <a
              key={`img-${i}`}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={file.url}
                alt={file.filename}
                className="max-w-[200px] max-h-[150px] rounded-lg border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow object-cover"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}

      {/* Inline video previews */}
      {showPreviews && videoAttachments.length > 0 && (
        <div className="space-y-2 mb-3">
          {videoAttachments.map((file, i) => (
            <video
              key={`vid-${i}`}
              src={file.url}
              controls
              className="max-w-full rounded-lg border border-[var(--border)]"
            />
          ))}
        </div>
      )}

      {/* File attachment links */}
      {otherAttachments.length > 0 && (
        <>
          <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider mb-2 opacity-70">
            Attachments ({otherAttachments.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {otherAttachments.map((file, i) => (
              <a
                key={i}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
              >
                <span className="material-icons text-[18px] text-blue-500">{getFileIcon(file.type)}</span>
                <span className="text-[12px] text-[var(--text-primary)] font-light max-w-[200px] truncate">
                  {file.filename}
                </span>
                <span className="material-icons text-[14px] text-[var(--text-secondary)] opacity-0 group-hover:opacity-60 transition-opacity">
                  download
                </span>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
