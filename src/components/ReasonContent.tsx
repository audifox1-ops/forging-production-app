import type { EquipmentReasonGroup } from '../utils/reasonGroups';

type ReasonContentProps = {
  group: EquipmentReasonGroup;
  labelClassName?: string;
};

type ReasonTextListProps = {
  values?: string[];
  fallback?: string;
};

function getJoinedText(values?: string[]) {
  return values?.filter(Boolean).join('\n/\n') ?? '';
}

export function ReasonTextList({ values, fallback = '-' }: ReasonTextListProps) {
  const text = getJoinedText(values);

  if (!text) return <>{fallback}</>;

  return <span className="reason-text">{text}</span>;
}

export default function ReasonContent({
  group,
  labelClassName = 'font-medium text-gray-700',
}: ReasonContentProps) {
  const rows = [
    { label: '상세 원인', values: group.reasonDetails },
  ].filter(row => row.values.length > 0);

  if (rows.length === 0) return <>-</>;

  return (
    <div className="reason-content">
      {rows.map(row => (
        <div key={row.label} className="reason-content-row">
          <span className={labelClassName}>{row.label}:</span>
          <ReasonTextList values={row.values} />
        </div>
      ))}
    </div>
  );
}
