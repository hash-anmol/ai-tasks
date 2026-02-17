"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

// Detect image URLs embedded in text
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
const VIDEO_EXTS = ["mp4", "mov", "webm", "avi"];

function isImageUrl(url: string): boolean {
  try {
    const ext = new URL(url).pathname.split(".").pop()?.toLowerCase() || "";
    return IMAGE_EXTS.includes(ext);
  } catch {
    return false;
  }
}

function isVideoUrl(url: string): boolean {
  try {
    const ext = new URL(url).pathname.split(".").pop()?.toLowerCase() || "";
    return VIDEO_EXTS.includes(ext);
  } catch {
    return false;
  }
}

const markdownComponents: Components = {
  // Render links — if link points to an image/video, render inline media
  a({ href, children }) {
    if (href && isImageUrl(href)) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block my-2">
          <img
            src={href}
            alt={typeof children === "string" ? children : "image"}
            className="max-w-full rounded-lg border border-[var(--border)] shadow-sm"
            loading="lazy"
          />
        </a>
      );
    }
    if (href && isVideoUrl(href)) {
      return (
        <video
          src={href}
          controls
          className="max-w-full rounded-lg border border-[var(--border)] my-2"
        />
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 hover:text-blue-600 underline underline-offset-2 transition-colors"
      >
        {children}
      </a>
    );
  },
  // Inline images
  img({ src, alt }) {
    return (
      <img
        src={src}
        alt={alt || "image"}
        className="max-w-full rounded-lg border border-[var(--border)] shadow-sm my-2"
        loading="lazy"
      />
    );
  },
  // Code blocks
  code({ className, children, ...props }) {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <div className="my-2 rounded-lg bg-[var(--background)] border border-[var(--border)] overflow-x-auto">
          <code className={`${className} block p-3 text-[12px] font-mono leading-relaxed`} {...props}>
            {children}
          </code>
        </div>
      );
    }
    return (
      <code className="px-1 py-0.5 rounded bg-[var(--background)] border border-[var(--border)] text-[12px] font-mono" {...props}>
        {children}
      </code>
    );
  },
  pre({ children }) {
    return <>{children}</>;
  },
  // Paragraphs
  p({ children }) {
    return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
  },
  // Lists
  ul({ children }) {
    return <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>;
  },
  li({ children }) {
    return <li className="leading-relaxed">{children}</li>;
  },
  // Headings
  h1({ children }) {
    return <h1 className="text-lg font-semibold mb-2 mt-3 first:mt-0">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-base font-semibold mb-1.5 mt-2.5 first:mt-0">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>;
  },
  // Blockquote
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-[var(--border)] pl-3 my-2 text-[var(--text-secondary)] italic">
        {children}
      </blockquote>
    );
  },
  // Table
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="text-[12px] border-collapse w-full">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-[var(--border)] px-2 py-1 bg-[var(--surface)] text-left font-semibold text-[11px]">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-[var(--border)] px-2 py-1 text-[12px]">{children}</td>
    );
  },
  // Horizontal rule
  hr() {
    return <hr className="my-3 border-[var(--border)]" />;
  },
  // Strong / emphasis
  strong({ children }) {
    return <strong className="font-semibold">{children}</strong>;
  },
};

interface MarkdownResponseProps {
  content: string;
  className?: string;
  /** Compact mode for previews — smaller text, no large block elements */
  compact?: boolean;
}

export default function MarkdownResponse({ content, className = "", compact = false }: MarkdownResponseProps) {
  if (!content) return null;

  const sizeClass = compact
    ? "text-[12px] font-light leading-snug"
    : "text-[13px] font-light leading-relaxed";

  return (
    <div className={`${sizeClass} text-[var(--text-primary)] font-body prose-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
