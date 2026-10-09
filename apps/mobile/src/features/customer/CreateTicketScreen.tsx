import { Button, Card, Chip, Input, Label, Select, TextArea, TextField } from 'heroui-native';
import { useRef, useState } from 'react';
import { Image, Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import type { PickedFile } from '../../../lib/uploads-api';
import type { TicketFormOptions } from '../../types/ticket-api';

const MAX_ATTACHMENTS = 5;

export type CreateTicketForm = {
  facilityId: string | null;
  storageUnitId: string | null;
  typeId: string | null;
  subject: string;
  description: string;
  photos: PickedFile[];
};

type Props = {
  /** Null while loading; `{facilities: []}` means the customer rents nothing. */
  options: TicketFormOptions | null;
  error: string | null;
  form: CreateTicketForm;
  isSubmitting: boolean;
  onChange: (patch: Partial<CreateTicketForm>) => void;
  onPickPhotos: () => void;
  onRemovePhoto: (uri: string) => void;
  onSubmit: () => void;
  onRetryOptions: () => void;
};

export function CreateTicketScreen({
  options,
  error,
  form,
  isSubmitting,
  onChange,
  onPickPhotos,
  onRemovePhoto,
  onSubmit,
  onRetryOptions,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const svHeight = useRef(0);
  const formTop = useRef(0);
  const fieldBottom = useRef<Record<'subject' | 'description', number>>({
    subject: 0,
    description: 0,
  });
  const facility = options?.facilities.find((f) => f.id === form.facilityId) ?? null;
  // Keyboard events never reach this screen (KAV and automaticallyAdjustKeyboardInsets
  // are both dead here), so grow the scroll content while a field is focused instead —
  // focus implies the keyboard is opening on a phone.
  const [editing, setEditing] = useState(false);

  // Scroll just enough to lift the focused field's bottom edge above the keyboard —
  // delayed past the slide-up animation so the extra bottom padding exists first.
  // ponytail: KB_ESTIMATE is a guess since real keyboard height never arrives; bump it
  // if a taller keyboard (emoji panel) still covers the field.
  const KB_ESTIMATE = 400;
  const scrollToField = (key: 'subject' | 'description') => {
    setTimeout(() => {
      const bottom = formTop.current + fieldBottom.current[key];
      const visibleBottom = svHeight.current - KB_ESTIMATE - 16;
      const target = Math.max(bottom - visibleBottom, 0);
      if (target > scrollY.current + 8) {
        scrollRef.current?.scrollTo({ y: target, animated: true });
      }
    }, 300);
  };
  const canSubmit =
    form.facilityId !== null &&
    form.typeId !== null &&
    form.subject.trim().length > 0 &&
    form.description.trim().length > 0 &&
    !isSubmitting;

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: editing ? 240 : 32 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onLayout={(e) => {
        svHeight.current = e.nativeEvent.layout.height;
      }}
      scrollEventThrottle={200}
      onScroll={(e) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
        // Hiding the keyboard via the keyboard's own button doesn't blur the input —
        // without it the extra padding would stick around after the keyboard is gone.
        if (editing && !Keyboard.isVisible()) setEditing(false);
      }}
    >
      <View className="px-4 pb-4 pt-5">
        <Text className="text-2xl font-bold tracking-tight text-foreground">Tạo yêu cầu</Text>
        <Text className="mt-1 text-sm leading-5 text-muted">
          Mô tả vấn đề bạn gặp tại cơ sở đang thuê.
        </Text>
      </View>

      <View
        className="gap-5 px-4"
        onLayout={(e) => {
          formTop.current = e.nativeEvent.layout.y;
        }}
      >
        {error ? (
          <View className="rounded-xl border border-danger/30 bg-danger/5 p-3">
            <Text className="text-sm text-danger">{error}</Text>
            <Button className="mt-3" size="sm" variant="secondary" onPress={onRetryOptions}>
              <Button.Label>Tải lại</Button.Label>
            </Button>
          </View>
        ) : null}

        {options !== null && options.facilities.length === 0 ? (
          <Card className="border border-border bg-surface">
            <Card.Body>
              <Text className="text-sm leading-5 text-muted">
                Bạn cần thuê kho để gửi yêu cầu hỗ trợ.
              </Text>
            </Card.Body>
          </Card>
        ) : null}

        {options !== null && options.facilities.length > 0 ? (
          <>
            <View className="gap-2">
              <Label>Cơ sở *</Label>
              <Select
                presentation="bottom-sheet"
                value={
                  facility
                    ? { value: facility.id, label: `${facility.name} (${facility.code})` }
                    : undefined
                }
                onValueChange={(option) =>
                  onChange({ facilityId: option?.value ?? null, storageUnitId: null })
                }
              >
                <Select.Trigger>
                  <Select.Value placeholder="Chọn cơ sở" />
                  <Select.TriggerIndicator />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Overlay />
                  <Select.Content presentation="bottom-sheet" snapPoints={['50%']}>
                    {options.facilities.map((f) => (
                      <Select.Item key={f.id} value={f.id} label={`${f.name} (${f.code})`} />
                    ))}
                  </Select.Content>
                </Select.Portal>
              </Select>
            </View>

            {facility && facility.units.length > 0 ? (
              <View className="gap-2">
                <Label>Kho đang thuê</Label>
                <View className="flex-row flex-wrap gap-2">
                  <Chip
                    color={form.storageUnitId === null ? 'accent' : 'default'}
                    variant={form.storageUnitId === null ? 'primary' : 'soft'}
                    onPress={() => onChange({ storageUnitId: null })}
                  >
                    <Chip.Label>Toàn cơ sở</Chip.Label>
                  </Chip>
                  {facility.units.map((unit) => (
                    <Chip
                      key={unit.id}
                      color={form.storageUnitId === unit.id ? 'accent' : 'default'}
                      variant={form.storageUnitId === unit.id ? 'primary' : 'soft'}
                      onPress={() => onChange({ storageUnitId: unit.id })}
                    >
                      <Chip.Label>{`${unit.name} (${unit.code})`}</Chip.Label>
                    </Chip>
                  ))}
                </View>
              </View>
            ) : null}

            <View className="gap-2">
              <Label>Loại yêu cầu *</Label>
              <Select
                presentation="bottom-sheet"
                value={
                  form.typeId
                    ? {
                        value: form.typeId,
                        label: options.types.find((t) => t.id === form.typeId)?.name ?? '',
                      }
                    : undefined
                }
                onValueChange={(option) => onChange({ typeId: option?.value ?? null })}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Chọn loại yêu cầu" />
                  <Select.TriggerIndicator />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Overlay />
                  <Select.Content presentation="bottom-sheet" snapPoints={['35%']}>
                    {options.types.map((type) => (
                      <Select.Item key={type.id} value={type.id} label={type.name} />
                    ))}
                  </Select.Content>
                </Select.Portal>
              </Select>
            </View>

            <View
              onLayout={(e) => {
                fieldBottom.current.subject = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
              }}
            >
              <TextField isRequired>
                <Label>Tiêu đề</Label>
                <Input
                  placeholder="Ví dụ: Cửa cuốn không lên được"
                  value={form.subject}
                  onChangeText={(subject) => onChange({ subject })}
                  onFocus={() => {
                    setEditing(true);
                    scrollToField('subject');
                  }}
                  onBlur={() => setEditing(false)}
                  maxLength={200}
                />
              </TextField>
            </View>

            <View
              onLayout={(e) => {
                fieldBottom.current.description =
                  e.nativeEvent.layout.y + e.nativeEvent.layout.height;
              }}
            >
              <TextField isRequired>
                <Label>Mô tả</Label>
                <TextArea
                  placeholder="Mô tả chi tiết vấn đề..."
                  value={form.description}
                  onChangeText={(description) => onChange({ description })}
                  onFocus={() => {
                    setEditing(true);
                    scrollToField('description');
                  }}
                  onBlur={() => setEditing(false)}
                  maxLength={5000}
                />
              </TextField>
            </View>

            <View className="gap-2">
              <Label>
                Ảnh đính kèm ({form.photos.length}/{MAX_ATTACHMENTS})
              </Label>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {form.photos.map((photo) => (
                  <Pressable key={photo.uri} onPress={() => onRemovePhoto(photo.uri)}>
                    <Image
                      source={{ uri: photo.uri }}
                      className="size-20 rounded-lg"
                      resizeMode="cover"
                    />
                    <View className="absolute right-1 top-1 size-5 items-center justify-center rounded-full bg-danger">
                      <Text className="text-[10px] font-bold text-white">×</Text>
                    </View>
                  </Pressable>
                ))}
                {form.photos.length < MAX_ATTACHMENTS ? (
                  <Pressable
                    onPress={onPickPhotos}
                    className="size-20 items-center justify-center rounded-lg border border-dashed border-border bg-surface"
                  >
                    <Text className="text-xl text-muted">+</Text>
                    <Text className="text-[10px] text-muted">Thêm ảnh</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>

            <Button isDisabled={!canSubmit} onPress={onSubmit}>
              <Button.Label>{isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}</Button.Label>
            </Button>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}
