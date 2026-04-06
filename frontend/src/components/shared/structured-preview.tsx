type StructuredPreviewProps = {
  data: unknown;
};

function renderValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "nao informado";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function StructuredPreview({ data }: StructuredPreviewProps) {
  if (!data || typeof data !== "object") {
    return <pre className="preformatted-block">{renderValue(data)}</pre>;
  }

  if (Array.isArray(data)) {
    return (
      <div className="content-list">
        {data.map((item, index) => (
          <div className="content-item" key={`${index}-${renderValue(item)}`}>
            {typeof item === "object" && item !== null ? <StructuredPreview data={item} /> : <small>{renderValue(item)}</small>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="content-list">
      {Object.entries(data).map(([key, value]) => (
        <div className="content-item" key={key}>
          <strong>{key}</strong>
          {typeof value === "object" && value !== null ? <StructuredPreview data={value} /> : <small>{renderValue(value)}</small>}
        </div>
      ))}
    </div>
  );
}
