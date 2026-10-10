import { Button, Input, Label, Select, TextArea, TextField } from 'heroui-native';
import { useRef, useState } from 'react';
import { Image, Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import type { PickedFile } from '../../../lib/uploads-api';
import { FilterPill } from '../../components/FilterPill';
import { ScreenHeader } from '../../components/ScreenHeader';
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
  onBack: () => void;
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
  onBack,
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
  // Types depend on the facility — a deposit-only facility offers no maintenance type.
  const types = facility
    ? (options?.types ?? []).filter((t) => facility.typeIds.includes(t.id))
    : [];
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
    <View className="flex-1">
      <ScreenHeader backLabel="Quay lại danh sách yêu cầu" title="Tạo yêu cầu" onBack={onBack} />
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
        <View className="px-4 pb-4">
          <Text className="font-body text-body-sm text-muted">
            Mô tả vấn đề bạn gặp tại kho đang thuê hoặc đã đặt cọc.
          </Text>
        </View>

        <View
          className="gap-5 px-4"
          onLayout={(e) => {
            formTop.current = e.nativeEvent.layout.y;
          }}
        >
          {error ? (
            <View className="rounded-xl border border-danger/30 bg-danger-bg p-3">
              <Text className="font-body text-body-sm text-danger">{error}</Text>
              <Button className="mt-3" size="sm" variant="secondary" onPress={onRetryOptions}>
                <Button.Label className="font-ui">Tải lại</Button.Label>
              </Button>
            </View>
          ) : null}

          {options !== null && options.facilities.length === 0 ? (
            <View className="rounded-xl border border-border bg-surface p-3">
              <Text className="font-body text-body-sm text-muted">
                Bạn cần đặt cọc hoặc thuê kho để gửi yêu cầu hỗ trợ.
              </Text>
            </View>
          ) : null}

          {options !== null && options.facilities.length > 0 ? (
            <>
              <View className="gap-2">
                <Label className="font-ui">Chi nhánh *</Label>
                <Select
                  presentation="bottom-sheet"
                  value={
                    facility
                      ? { value: facility.id, label: `${facility.name} (${facility.code})` }
                      : undefined
                  }
                  onValueChange={(option) => {
                    const next = options.facilities.find((f) => f.id === option?.value);
                    onChange({
                      facilityId: next?.id ?? null,
                      storageUnitId: null,
                      // Drop a picked type the new facility does not allow.
                      typeId:
                        form.typeId && next?.typeIds.includes(form.typeId) ? form.typeId : null,
                    });
                  }}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Chọn chi nhánh" />
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
                  <Label className="font-ui">Kho đang thuê</Label>
                  <View className="flex-row flex-wrap gap-2">
                    <FilterPill
                      isSelected={form.storageUnitId === null}
                      label="Toàn chi nhánh"
                      onPress={() => onChange({ storageUnitId: null })}
                    />
                    {facility.units.map((unit) => (
                      <FilterPill
                        key={unit.id}
                        isSelected={form.storageUnitId === unit.id}
                        label={`${unit.name} (${unit.code})`}
                        onPress={() => onChange({ storageUnitId: unit.id })}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <View className="gap-2">
                <Label className="font-ui">Loại yêu cầu *</Label>
                <Select
                  presentation="bottom-sheet"
                  value={
                    form.typeId
                      ? {
                          value: form.typeId,
                          label: types.find((t) => t.id === form.typeId)?.name ?? '',
                        }
                      : undefined
                  }
                  onValueChange={(option) => onChange({ typeId: option?.value ?? null })}
                  isDisabled={!facility}
                >
                  <Select.Trigger>
                    <Select.Value
                      placeholder={facility ? 'Chọn loại yêu cầu' : 'Chọn chi nhánh trước'}
                    />
                    <Select.TriggerIndicator />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Overlay />
                    <Select.Content presentation="bottom-sheet" snapPoints={['35%']}>
                      {types.map((type) => (
                        <Select.Item key={type.id} value={type.id} label={type.name} />
                      ))}
                    </Select.Content>
                  </Select.Portal>
                </Select>
              </View>

              <View
                onLayout={(e) => {
                  fieldBottom.current.subject =
                    e.nativeEvent.layout.y + e.nativeEvent.layout.height;
                }}
              >
                <TextField isRequired>
                  <Label className="font-ui">Tiêu đề</Label>
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
                  <Label className="font-ui">Mô tả</Label>
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
                <Label className="font-ui">
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
                        <Text className="text-caption font-strong text-white">×</Text>
                      </View>
                    </Pressable>
                  ))}
                  {form.photos.length < MAX_ATTACHMENTS ? (
                    <Pressable
                      onPress={onPickPhotos}
                      className="size-20 items-center justify-center rounded-lg border border-dashed border-border bg-surface"
                    >
                      <Text className="font-body text-title-md text-muted">+</Text>
                      <Text className="font-body text-caption text-muted">Thêm ảnh</Text>
                    </Pressable>
                  ) : null}
                </ScrollView>
              </View>

              <Button isDisabled={!canSubmit} onPress={onSubmit}>
                <Button.Label className="font-ui">
                  {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </Button.Label>
              </Button>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
