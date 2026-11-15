import { assigneeLabel } from '../../../../lib/shelf-storage-format';
import { Text } from '../../../components/ui';

/** Who a request was given to; the viewer's own requests stand out. */
export function AssigneeLine({
  assignedTo,
  myId,
}: {
  assignedTo: { id: string; fullName: string } | null | undefined;
  myId: string | undefined;
}) {
  const { text, mine } = assigneeLabel(assignedTo, myId);
  return (
    <Text
      className={`text-caption ${
        mine
          ? 'font-semibold text-text-link'
          : assignedTo
            ? 'text-text-secondary'
            : 'font-medium text-warning-700'
      }`}
    >
      {text}
    </Text>
  );
}
