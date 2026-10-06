"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { Popover } from "./popover";

export function SelectionDropdown({ label, value, options, onChange, className = "" }: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (value: string) => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  return <Popover label={label} open={open} onOpenChange={setOpen} className={`selection-dropdown ${className}`}
    trigger={<><span className="selected-label">{selected?.label || label}</span><FontAwesomeIcon icon={faChevronDown} aria-hidden="true" /></>}>
    {options.map(option => <button type="button" role="menuitemradio" aria-checked={option.value === value}
      className={`menu-option compact ${option.value === value ? "selected" : ""}`} key={option.value}
      onClick={() => { onChange(option.value); setOpen(false); }}>
      <span>{option.label}</span>{option.value === value && <FontAwesomeIcon icon={faCheck} aria-hidden="true" />}
    </button>)}
  </Popover>;
}
