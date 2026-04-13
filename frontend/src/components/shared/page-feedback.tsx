import type { ReactNode } from "react";

type PageFeedbackType = "success" | "error" | "info" | "warning";

type PageFeedbackProps = {
  type: PageFeedbackType;
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
};

export function PageFeedback({ type, title, description, action, children }: PageFeedbackProps) {
  return (
    <div className={`page-feedback page-feedback--${type}`} role={type === "error" ? "alert" : "status"}>
      <span className="page-feedback-icon" aria-hidden="true">
        {type === "success" && iconCircleCheck}
        {type === "error" && iconCircleX}
        {type === "info" && iconCircleInfo}
        {type === "warning" && iconTriangle}
      </span>
      <div className="page-feedback-content">
        <strong className="page-feedback-title">{title}</strong>
        {description ? <p className="page-feedback-description">{description}</p> : null}
        {children}
      </div>
      {action ? <div className="page-feedback-action">{action}</div> : null}
    </div>
  );
}

const iconCircleCheck = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const iconCircleX = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </svg>
);

const iconCircleInfo = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

const iconTriangle = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);
