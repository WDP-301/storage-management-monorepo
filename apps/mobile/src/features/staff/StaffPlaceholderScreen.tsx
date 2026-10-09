import { Card, Chip } from 'heroui-native';
import { ScrollView, Text, View } from 'react-native';

type Props = {
  title: string;
  description: string;
  /** Upcoming capabilities of this tab, taken from the business spec. */
  upcoming: string[];
};

/** Temporary content for staff tabs until the facility operation APIs exist. */
export function StaffPlaceholderScreen({ title, description, upcoming }: Props) {
  return (
    <ScrollView contentContainerClassName="px-4 pb-8 pt-5" showsVerticalScrollIndicator={false}>
      <Text className="text-title-md font-display tracking-tight text-foreground">{title}</Text>
      <Text className="font-body mt-1 text-body-sm leading-5 text-muted">{description}</Text>

      <Card className="mt-5 border border-border bg-surface">
        <Card.Body className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-strong text-foreground">Tính năng sắp có</Text>
            <Chip color="warning" size="sm" variant="soft">
              <Chip.Label className="font-ui">Sắp ra mắt</Chip.Label>
            </Chip>
          </View>
          <View className="h-px bg-separator" />
          <View className="gap-3">
            {upcoming.map((item) => (
              <View key={item} className="flex-row gap-3">
                <View className="mt-2 size-1.5 rounded-full bg-accent" />
                <Text className="font-body flex-1 text-body-sm leading-5 text-foreground">
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </Card.Body>
      </Card>
    </ScrollView>
  );
}
