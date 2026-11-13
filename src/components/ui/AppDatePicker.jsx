import { useTranslation } from 'react-i18next';
import { enGB, fr } from 'date-fns/locale';
import React, { forwardRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import { CalendarDays, CircleAlert } from 'lucide-react';
import AppIcon from './AppIcon';
import 'react-datepicker/dist/react-datepicker.css';
import './AppDatePicker.css';

const pad = (value) => String(value).padStart(2, '0');

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const formatDateValue = (date) => {
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const DateInput = forwardRef(({ value, onClick, onChange, onKeyDown, placeholder, disabled }, ref) => (
  <input
    ref={ref}
    type="text"
    className="app-date__input"
    value={value || ''}
    onClick={onClick}
    onChange={onChange}
    onKeyDown={onKeyDown}
    placeholder={placeholder}
    disabled={disabled}
    autoComplete="off"
    readOnly
  />
));

DateInput.displayName = 'DateInput';

const AppDatePicker = ({
  label,
  value,
  onChange,
  error,
  placeholder = 'dd/mm/yyyy',
  disabled = false,
  name,
  minDate,
  maxDate,
  clearable = true,
}) => {
  const { i18n } = useTranslation();
  const isFrench = i18n.resolvedLanguage === 'fr';
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateValue(value);

  const close = () => setOpen(false);

  return (
    <div className={`app-date ${error ? 'app-date--error' : ''} ${disabled ? 'app-date--disabled' : ''}`}>
      {label && <label className="app-date__label" htmlFor={name}>{label}</label>}

      <div className="app-date__control">
        <AppIcon icon={CalendarDays} size={16} className="app-date__icon" />

        <DatePicker
          id={name}
          name={name}
          selected={selectedDate}
          onChange={(date) => {
            onChange?.(formatDateValue(date));
            close();
          }}
          onCalendarOpen={() => setOpen(true)}
          onCalendarClose={close}
          onClickOutside={close}
          onInputClick={() => !disabled && setOpen(true)}
          onSelect={close}
          open={open}
          shouldCloseOnSelect
          dateFormat="dd/MM/yyyy"
          locale={isFrench ? fr : enGB}
          placeholderText={placeholder}
          disabled={disabled}
          minDate={parseDateValue(minDate)}
          maxDate={parseDateValue(maxDate)}
          showMonthDropdown
          showYearDropdown
          dropdownMode="select"
          isClearable={clearable && !disabled && Boolean(value)}
          calendarClassName="app-date__calendar"
          popperClassName="app-date__popper"
          wrapperClassName="app-date__picker-wrap"
          customInput={(
            <DateInput
              placeholder={placeholder}
              disabled={disabled}
              onKeyDown={(event) => {
                if (event.key === 'Escape') close();
              }}
            />
          )}
        />
      </div>

      {error && <p className="app-date__error"><AppIcon icon={CircleAlert} size={14} /> {error}</p>}
    </div>
  );
};

export default AppDatePicker;
