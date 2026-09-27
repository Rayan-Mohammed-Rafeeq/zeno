import { CheckCircle2 } from 'lucide-react';

export type AccountRole = 'PROVIDER' | 'PRACTICE_STAFF' | 'PHARMACIST';

export interface AccountTypeOption {
  role: AccountRole;
  title: string;
  subtitle: string;
  iconSrc: string;
}

export const ACCOUNT_ROLES: AccountTypeOption[] = [
  {
    role: 'PROVIDER',
    title: "Doctor / Provider",
    subtitle: 'Authorize refills & issue new prescriptions',
    iconSrc: '/doctor_role.svg',
  },
  {
    role: 'PRACTICE_STAFF',
    title: "Practice Staff / Nurse",
    subtitle: 'Coordinate intake & gather chart records',
    iconSrc: '/nurse_role.svg',
  },
  {
    role: 'PHARMACIST',
    title: "Pharmacist",
    subtitle: 'Submit refill requests & dispense medications',
    iconSrc: '/pharmacist_role.svg',
  },
];

interface AccountTypeSelectorProps {
  selectedRole: AccountRole;
  onSelectRole: (role: AccountRole) => void;
  title?: string;
  subtitle?: string;
}

export function AccountTypeSelector({
  selectedRole,
  onSelectRole,
  title = 'Who are you?',
  subtitle = 'Choose your role to get started',
}: AccountTypeSelectorProps) {
  return (
    <div className="space-y-3 mb-2">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-base font-bold text-gray-800 tracking-tight">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>

      {/* Role Cards — 3-column grid */}
      <div className="grid grid-cols-3 gap-2">
        {ACCOUNT_ROLES.map((opt) => {
          const isSelected = selectedRole === opt.role;
          return (
            <button
              key={opt.role}
              type="button"
              onClick={() => onSelectRole(opt.role)}
              className="group relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              style={{
                borderColor: isSelected ? '#6366f1' : 'transparent',
                background: isSelected
                  ? 'linear-gradient(145deg, rgba(99,102,241,0.08), rgba(79,70,229,0.04))'
                  : 'rgba(0,0,0,0.03)',
                boxShadow: isSelected
                  ? '0 0 0 3px rgba(99,102,241,0.12), 0 2px 10px rgba(99,102,241,0.1)'
                  : '0 1px 3px rgba(0,0,0,0.06)',
              }}
              aria-pressed={isSelected}
              aria-label={opt.title}
            >
              {/* Selected checkmark badge */}
              {isSelected && (
                <span className="absolute top-1.5 right-1.5 text-indigo-500">
                  <CheckCircle2 size={13} />
                </span>
              )}

              {/* Role illustration */}
              <img
                src={opt.iconSrc}
                alt={opt.title}
                className="w-11 h-11 object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
                draggable={false}
              />

              {/* Label only — no subtitle to reduce clutter */}
              <p
                className="text-[11px] font-bold leading-tight text-center"
                style={{ color: isSelected ? '#4f46e5' : '#1e1b4b' }}
              >
                {opt.title}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
