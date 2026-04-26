type ConfirmModalProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  details?: string[];
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
};

export function ConfirmModal({
  cancelLabel = "Cancelar",
  confirmLabel = "Confirmar",
  description,
  details = [],
  disabled = false,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="confirm-modal-backdrop" role="presentation">
      <div aria-describedby="confirm-modal-description" aria-labelledby="confirm-modal-title" aria-modal="true" className="confirm-modal" role="dialog">
        <h2 id="confirm-modal-title">{title}</h2>
        <p id="confirm-modal-description">{description}</p>
        {details.length ? (
          <dl className="confirm-modal-details">
            {details.map((detail) => {
              const [label, value] = detail.split(": ");
              return (
                <div key={detail}>
                  <dt>{value ? label : "Contexto"}</dt>
                  <dd>{value ?? detail}</dd>
                </div>
              );
            })}
          </dl>
        ) : null}
        <div className="confirm-modal-actions">
          <button className="admin-pagination-btn" disabled={disabled} onClick={onCancel} style={{ width: "auto", padding: "0 14px" }} type="button">
            {cancelLabel}
          </button>
          <button className="admin-page-cta" disabled={disabled} onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
