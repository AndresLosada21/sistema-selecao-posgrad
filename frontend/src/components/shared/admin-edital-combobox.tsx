"use client";

import { useEffect, useMemo, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { listAdminEditais } from "@/modules/admin-edital/api";
import type { EditalListItem } from "@/modules/edital/types";

type AdminEditalComboboxProps = {
  token: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelectOption?: (edital: EditalListItem) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  required?: boolean;
  allowEmpty?: boolean;
};

function getEditalLabel(edital: EditalListItem) {
  return `${edital.numero} · ${edital.titulo}`;
}

export function AdminEditalCombobox({
  token,
  label,
  value,
  onChange,
  onSelectOption,
  placeholder = "Digite numero ou titulo do edital",
  emptyLabel = "Todos os editais",
  disabled = false,
  required = false,
  allowEmpty = true,
}: AdminEditalComboboxProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [options, setOptions] = useState<EditalListItem[]>([]);
  const [selectedOption, setSelectedOption] = useState<EditalListItem | null>(null);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      if (!token) return;
      setLoading(true);
      try {
        const response = await listAdminEditais(token, {
          page: 1,
          pageSize: 10,
          q: debouncedQuery || undefined,
        });
        if (cancelled) return;
        setOptions(response.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOptions();
    return () => { cancelled = true; };
  }, [debouncedQuery, token]);

  useEffect(() => {
    if (!value) {
      setSelectedOption(null);
      return;
    }

    const found = options.find((item) => item.id === value);
    if (found) {
      setSelectedOption(found);
    }
  }, [options, value]);

  const inputValue = useMemo(() => {
    if (focused) return query;
    if (selectedOption) return getEditalLabel(selectedOption);
    return query;
  }, [focused, query, selectedOption]);

  function handleSelect(edital: EditalListItem) {
    setSelectedOption(edital);
    setQuery(getEditalLabel(edital));
    onChange(edital.id);
    onSelectOption?.(edital);
    setFocused(false);
  }

  function handleClear() {
    setSelectedOption(null);
    setQuery("");
    onChange("");
    setFocused(false);
  }

  const visibleOptions = focused ? options : [];

  return (
    <label className="field-block">
      <span>{label}</span>
      <input
        disabled={disabled}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!event.target.value) {
            setSelectedOption(null);
            onChange("");
          }
        }}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        required={required}
        value={inputValue}
      />
      {focused ? (
        <div className="content-list" style={{ marginTop: "var(--space-2)" }}>
          {allowEmpty ? (
            <ActionButton onMouseDown={(event) => event.preventDefault()} onClick={handleClear} size="sm" type="button" variant="ghost">
              {emptyLabel}
            </ActionButton>
          ) : null}
          {visibleOptions.map((edital) => (
            <ActionButton
              key={edital.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(edital)}
              size="sm"
              type="button"
              variant={selectedOption?.id === edital.id ? "secondary" : "ghost"}
            >
              {getEditalLabel(edital)}
            </ActionButton>
          ))}
          {!visibleOptions.length && !loading ? <small>Nenhum edital encontrado para a busca atual.</small> : null}
          {loading ? <small>Buscando editais...</small> : null}
        </div>
      ) : null}
    </label>
  );
}
