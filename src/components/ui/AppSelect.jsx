import { useTranslation } from 'react-i18next';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, CircleAlert, Search, X } from 'lucide-react';
import AppIcon from './AppIcon';
import './AppSelect.css';

const normalizeOption = (option) => {
  if (typeof option === 'string' || typeof option === 'number') {
    return { value: option, label: String(option) };
  }

  return option;
};

const AppSelect = ({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  searchable = false,
  clearable = true,
  disabled = false,
  error,
  icon = ChevronDown,
  name,
}) => {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const wrapRef = useRef(null);
  const dropdownRef = useRef(null);
  const [floatingStyle, setFloatingStyle] = useState({});
  const inputRef = useRef(null);
  const optionRefs = useRef([]);

  const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);

  const selected =
    normalizedOptions.find((option) => String(option.value) === String(value)) || null;

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return normalizedOptions;

    const q = query.toLowerCase();

    return normalizedOptions.filter((option) => {
      const labelText = String(option.label || '').toLowerCase();
      const valueText = String(option.value || '').toLowerCase();
      const metaText = String(option.meta || '').toLowerCase();
      const descText = String(option.description || '').toLowerCase();

      return (
        labelText.includes(q) ||
        valueText.includes(q) ||
        metaText.includes(q) ||
        descText.includes(q)
      );
    });
  }, [normalizedOptions, query, searchable]);

  const getSelectedIndex = () => {
    if (!selected) return filtered.length ? 0 : -1;

    const index = filtered.findIndex(
      (option) => String(option.value) === String(selected.value)
    );

    return index >= 0 ? index : filtered.length ? 0 : -1;
  };

  // Portaling avoids overflow clipping in modal bodies, drawers and tables.
  // Measure the trigger and flip above it when the viewport has less space below.
  const updateDropdownPosition = useCallback(() => {
    const anchor = wrapRef.current?.querySelector('.app-select__trigger');
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 7;
    const edge = 10;
    const below = Math.max(0, window.innerHeight - rect.bottom - gap - edge);
    const above = Math.max(0, rect.top - gap - edge);
    const desired = 14 + (searchable ? 45 : 0) + Math.min(230, Math.max(48, filtered.length * 49));
    const flip = below < Math.min(180, desired) && above > below;
    const room = flip ? above : below;
    const maxHeight = Math.max(56, Math.min(292, room));
    const shownHeight = Math.min(desired, maxHeight);
    const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 2 * edge);
    const left = Math.max(edge, Math.min(rect.left, window.innerWidth - width - edge));
    const top = flip ? Math.max(edge, rect.top - gap - shownHeight) : Math.min(window.innerHeight - edge - shownHeight, rect.bottom + gap);

    // Floating lists are mounted under document.body, outside page/modals.
    // Resolve the active theme's existing tokens and pass them to the portal.
    const computed = getComputedStyle(wrapRef.current);
    const read = (...names) => names.map((name) => computed.getPropertyValue(name).trim()).find(Boolean);
    const tokens = {
      '--usr-card': read('--usr-card', '--apr-card', '--ai-bg') || '#fff',
      '--usr-border': read('--usr-border', '--apr-border', '--ai-border') || '#e5e7eb',
      '--usr-text': read('--usr-text', '--apr-text', '--ai-text') || '#111827',
      '--usr-muted': read('--usr-muted', '--apr-muted', '--ai-muted') || '#6b7280',
      '--usr-soft': read('--usr-soft', '--apr-soft') || '#f3f4f6',
      '--usr-placeholder': read('--usr-placeholder', '--apr-placeholder') || '#9ca3af',
      '--usr-shadow-lg': read('--usr-shadow-lg', '--apr-shadow-lg') || '0 18px 50px rgba(15, 23, 42, .14)',
      '--app-green': read('--app-green') || '#3da050',
      '--app-green-dark': read('--app-green-dark') || '#2d8040',
      '--font-ui-regular': read('--font-ui-regular') || 'Montserrat, sans-serif',
      '--sel-hover': read('--sel-hover') || 'rgba(61,160,80,.12)',
      '--green': read('--green', '--app-green') || '#3da050',
    };
    setFloatingStyle({ ...tokens, top, left, width, maxHeight,
      '--app-select-list-max': `${Math.max(44, maxHeight - (searchable ? 48 : 4))}px`,
    });
  }, [filtered.length, searchable]);

  const openDropdown = () => {
    if (disabled) return;

    updateDropdownPosition();
    setOpen(true);
    setHighlightedIndex(getSelectedIndex());

    if (searchable) {
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  };

  const closeDropdown = () => {
    setOpen(false);
    setQuery('');
    setHighlightedIndex(-1);
  };

  const toggleOpen = () => {
    if (disabled) return;

    if (open) {
      closeDropdown();
      return;
    }

    setQuery('');
    openDropdown();
  };

  const selectOption = (option) => {
    if (!option) return;

    onChange?.(option.value, option);
    closeDropdown();
  };

  const clearSelection = (event) => {
    event.stopPropagation();

    onChange?.('', null);
    closeDropdown();
  };

  const moveHighlight = (direction) => {
    if (!filtered.length) {
      setHighlightedIndex(-1);
      return;
    }

    setHighlightedIndex((prev) => {
      if (prev < 0) return direction === 'down' ? 0 : filtered.length - 1;

      if (direction === 'down') {
        return prev >= filtered.length - 1 ? 0 : prev + 1;
      }

      return prev <= 0 ? filtered.length - 1 : prev - 1;
    });
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();

        if (!open) {
          openDropdown();
          return;
        }

        moveHighlight('down');
        break;

      case 'ArrowUp':
        event.preventDefault();

        if (!open) {
          openDropdown();
          return;
        }

        moveHighlight('up');
        break;

      case 'Enter':
        if (!open) return;

        event.preventDefault();

        if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
          selectOption(filtered[highlightedIndex]);
        }

        break;

      case 'Escape':
        if (!open) return;

        event.preventDefault();
        closeDropdown();
        break;

      case 'Tab':
        closeDropdown();
        break;

      default:
        break;
    }
  };

  useEffect(() => {
    const handleOutside = (event) => {
      if (!wrapRef.current?.contains(event.target) && !dropdownRef.current?.contains(event.target)) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleOutside);

    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updateDropdownPosition();
    const reposition = () => updateDropdownPosition();
    window.addEventListener('resize', reposition);
    // Capture nested scroll containers as well as the page scroll.
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, updateDropdownPosition]);

  useEffect(() => {
    if (!open) return;

    setHighlightedIndex(getSelectedIndex());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setHighlightedIndex(filtered.length ? 0 : -1);
  }, [query, filtered.length, open]);

  useEffect(() => {
    if (!open || highlightedIndex < 0) return;

    optionRefs.current[highlightedIndex]?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [highlightedIndex, open]);

  const usesChevron = icon === ChevronDown || icon === 'ChevronDown';

  return (
    <div
      className={[
        'app-select',
        open ? 'app-select--open' : '',
        disabled ? 'app-select--disabled' : '',
        error ? 'app-select--error' : '',
      ].filter(Boolean).join(' ')}
      ref={wrapRef}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label className="app-select__label" htmlFor={name}>
          {label}
        </label>
      )}

      <button
        type="button"
        className="app-select__trigger"
        id={name}
        onClick={toggleOpen}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`app-select__value ${!selected ? 'app-select__value--placeholder' : ''}`}>
          {selected ? selected.label : (placeholder ?? t('select_option'))}
        </span>

        {selected && clearable && !disabled && (
          <span
            className="app-select__clear"
            role="button"
            aria-label={t('clear_selection')}
            tabIndex={-1}
            onClick={clearSelection}
          >
            <AppIcon icon={X} size={15} />
          </span>
        )}

        <AppIcon
          icon={icon}
          fallback={ChevronDown}
          size={15}
          className={`app-select__chevron ${usesChevron && open ? 'app-select__chevron--open' : ''}`}
        />
      </button>

      {createPortal(<AnimatePresence>
        {open && (
          <motion.div
            ref={dropdownRef}
            style={floatingStyle}
            onMouseDown={(event) => event.stopPropagation()}
            className={`app-select__dropdown app-select__dropdown--floating ${wrapRef.current?.closest('.theme-dark') ? 'theme-dark' : ''}`}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            {searchable && (
              <div className="app-select__search-row">
                <AppIcon icon={Search} size={15} className="app-select__search-icon" />

                <input
                  ref={inputRef}
                  className="app-select__search"
                  type="text"
                  placeholder={t('search')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            )}

            <div className="app-select__list" role="listbox">
              {filtered.length === 0 ? (
                <p className="app-select__empty">{t('no_options_found')}</p>
              ) : (
                filtered.map((option, index) => {
                  const isActive =
                    selected && String(selected.value) === String(option.value);

                  const isHighlighted = highlightedIndex === index;

                  return (
                    <button
                      key={`${option.value}-${option.label}`}
                      ref={(node) => {
                        optionRefs.current[index] = node;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={[
                        'app-select__option',
                        isActive ? 'app-select__option--active' : '',
                        isHighlighted ? 'app-select__option--highlighted' : '',
                      ].filter(Boolean).join(' ')}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => selectOption(option)}
                    >
                      <span>
                        <span className="app-select__option-label">
                          {option.label}
                        </span>

                        {option.description && (
                          <span className="app-select__option-desc">
                            {option.description}
                          </span>
                        )}
                      </span>

                      {isActive && <AppIcon icon={Check} size={15} className="app-select__check" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}

      {error && (
        <p className="app-select__error">
          <AppIcon icon={CircleAlert} size={14} /> {error}
        </p>
      )}
    </div>
  );
};

export default AppSelect;
