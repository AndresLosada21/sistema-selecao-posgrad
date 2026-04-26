"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type AdminStatusFilterOption = {
  value: string;
  label: string;
};

type AdminStatusFilterProps = {
  ariaLabel: string;
  onChange: (value: string) => void;
  options: AdminStatusFilterOption[];
  value: string;
  queryParam?: string;
};

export function AdminStatusFilter({ ariaLabel, onChange, options, queryParam = "status", value }: AdminStatusFilterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(nextValue: string) {
    const params = new URLSearchParams(searchParams?.toString());

    if (nextValue) {
      params.set(queryParam, nextValue);
    } else {
      params.delete(queryParam);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    onChange(nextValue);
  }

  return (
    <div aria-label={ariaLabel} className="admin-status-filter" role="radiogroup">
      {options.map((option) => {
        const selected = value === option.value;

        return (
          <button
            aria-checked={selected}
            className={`admin-status-filter-button${selected ? " admin-status-filter-button--active" : ""}`}
            key={option.value || "todos"}
            onClick={() => handleChange(option.value)}
            role="radio"
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
