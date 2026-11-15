import { Text } from './text';

/** Form field label in Techvera `text-caption font-medium text-text-label`. */
export function FieldLabel({
  children,
  required = false,
  testID,
}: {
  children: string;
  required?: boolean;
  testID?: string;
}) {
  return (
    <Text className="mb-1.5 text-caption font-medium text-text-label" testID={testID}>
      {children}
      {required ? <Text className="text-caption font-medium text-status-danger"> *</Text> : null}
    </Text>
  );
}
