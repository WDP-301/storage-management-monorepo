import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { CaretDown, Check } from 'phosphor-react-native';
import { type RefObject, useRef, useState } from 'react';
import { Image, Keyboard, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PickedFile } from '../../../lib/uploads-api';
import {
  Button,
  colors,
  FieldLabel,
  FlowScreen,
  InlineMessage,
  Input,
  renderCoatBackdrop,
  TabChip,
  Text,
} from '../../components/ui';
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
  /** Set while reporting a wrong receipt; shows which receipt the ticket is linked to. */
  linkedReceiptCode?: string | null;
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
  linkedReceiptCode,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const facilitySheetRef = useRef<BottomSheetModal>(null);
  const typeSheetRef = useRef<BottomSheetModal>(null);
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
  const selectedType = types.find((t) => t.id === form.typeId) ?? null;

  // Keyboard events never reach this screen reliably across all sheets/containers,
  // so grow scroll padding while a field is focused and scroll it above the keyboard.
  const [editing, setEditing] = useState(false);

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
    <FlowScreen muted onBack={onBack} title="Tạo yêu cầu" titleAlign="left">
      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-bg-muted"
        contentContainerStyle={{ padding: 16, paddingBottom: editing ? 240 : 36, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onLayout={(e) => {
          svHeight.current = e.nativeEvent.layout.height;
        }}
        scrollEventThrottle={200}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
          if (editing && !Keyboard.isVisible()) setEditing(false);
        }}
      >
        <Text className="text-body-sm text-text-secondary">
          Mô tả vấn đề bạn gặp tại kho đang thuê hoặc đã đặt cọc.
        </Text>

        <View
          className="gap-4"
          onLayout={(e) => {
            formTop.current = e.nativeEvent.layout.y;
          }}
        >
          {error ? (
            <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
              <InlineMessage message={error} type="error" />
              <Button label="Tải lại" onPress={onRetryOptions} size="sm" variant="secondary" />
            </View>
          ) : null}

          {linkedReceiptCode ? (
            <View className="rounded-2xl border border-warning-500/30 bg-warning-0 px-3.5 py-3">
              <Text className="text-body-sm font-semibold text-warning-700">
                Liên quan phiếu {linkedReceiptCode}
              </Text>
            </View>
          ) : null}

          {options !== null && options.facilities.length === 0 ? (
            <View className="rounded-[20px] border border-border-default bg-bg-card p-4">
              <Text className="text-body-sm leading-5 text-text-secondary">
                Bạn cần đặt cọc hoặc thuê kho để gửi yêu cầu hỗ trợ.
              </Text>
            </View>
          ) : null}

          {options !== null && options.facilities.length > 0 ? (
            <View className="gap-4 rounded-[20px] border border-border-default bg-bg-card p-4">
              <View className="gap-1.5">
                <FieldLabel required>Chi nhánh</FieldLabel>
                <SelectTriggerRow
                  label={facility ? facility.name : 'Chọn chi nhánh'}
                  isPlaceholder={!facility}
                  onPress={() => facilitySheetRef.current?.present()}
                />
              </View>

              {facility && facility.units.length > 0 ? (
                <View className="gap-2">
                  <FieldLabel>Kho đang thuê</FieldLabel>
                  <View className="flex-row flex-wrap gap-2">
                    <TabChip
                      label="Toàn chi nhánh"
                      onPress={() => onChange({ storageUnitId: null })}
                      selected={form.storageUnitId === null}
                      tone="primary"
                    />
                    {facility.units.map((unit) => (
                      <TabChip
                        key={unit.id}
                        label={unit.name}
                        onPress={() => onChange({ storageUnitId: unit.id })}
                        selected={form.storageUnitId === unit.id}
                        tone="primary"
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <View className="gap-1.5">
                <FieldLabel required>Loại yêu cầu</FieldLabel>
                <SelectTriggerRow
                  disabled={!facility}
                  isPlaceholder={!selectedType}
                  label={
                    selectedType
                      ? selectedType.name
                      : facility
                        ? 'Chọn loại yêu cầu'
                        : 'Chọn chi nhánh trước'
                  }
                  onPress={() => {
                    if (facility) typeSheetRef.current?.present();
                  }}
                />
              </View>

              <View
                onLayout={(e) => {
                  fieldBottom.current.subject =
                    e.nativeEvent.layout.y + e.nativeEvent.layout.height;
                }}
              >
                <Input
                  label="Tiêu đề"
                  maxLength={200}
                  onBlur={() => setEditing(false)}
                  onChangeText={(subject) => onChange({ subject })}
                  onFocus={() => {
                    setEditing(true);
                    scrollToField('subject');
                  }}
                  placeholder="Ví dụ: Cửa cuốn không lên được"
                  required
                  value={form.subject}
                />
              </View>

              <View
                onLayout={(e) => {
                  fieldBottom.current.description =
                    e.nativeEvent.layout.y + e.nativeEvent.layout.height;
                }}
              >
                <Input
                  label="Mô tả"
                  maxLength={5000}
                  multiline
                  onBlur={() => setEditing(false)}
                  onChangeText={(description) => onChange({ description })}
                  onFocus={() => {
                    setEditing(true);
                    scrollToField('description');
                  }}
                  placeholder="Mô tả chi tiết vấn đề..."
                  required
                  textAlignVertical="top"
                  value={form.description}
                />
              </View>

              <View className="gap-2">
                <FieldLabel>{`Ảnh đính kèm (${form.photos.length}/${MAX_ATTACHMENTS})`}</FieldLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10 }}
                >
                  {form.photos.map((photo) => (
                    <Pressable key={photo.uri} onPress={() => onRemovePhoto(photo.uri)}>
                      <Image
                        source={{ uri: photo.uri }}
                        className="size-20 rounded-xl"
                        resizeMode="cover"
                      />
                      <View className="absolute right-1 top-1 size-5 items-center justify-center rounded-full bg-status-danger">
                        <Text className="text-caption font-bold text-text-inverse">×</Text>
                      </View>
                    </Pressable>
                  ))}
                  {form.photos.length < MAX_ATTACHMENTS ? (
                    <Pressable
                      onPress={onPickPhotos}
                      className="size-20 items-center justify-center rounded-xl border border-dashed border-border-strong bg-bg-subtle"
                    >
                      <Text className="text-title text-text-secondary">+</Text>
                      <Text className="text-caption text-text-secondary">Thêm ảnh</Text>
                    </Pressable>
                  ) : null}
                </ScrollView>
              </View>
            </View>
          ) : null}

          {options !== null && options.facilities.length > 0 ? (
            <Button
              disabled={!canSubmit}
              fullWidth
              label={isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
              loading={isSubmitting}
              onPress={onSubmit}
            />
          ) : null}
        </View>
      </ScrollView>

      <OptionPickerSheet
        options={(options?.facilities ?? []).map((f) => ({ id: f.id, label: f.name }))}
        selectedId={form.facilityId}
        sheetRef={facilitySheetRef}
        title="Chọn chi nhánh"
        onSelect={(id) => {
          const next = options?.facilities.find((f) => f.id === id);
          onChange({
            facilityId: next?.id ?? null,
            storageUnitId: null,
            // Drop a picked type the new facility does not allow.
            typeId: form.typeId && next?.typeIds.includes(form.typeId) ? form.typeId : null,
          });
        }}
      />

      <OptionPickerSheet
        options={types.map((t) => ({ id: t.id, label: t.name }))}
        selectedId={form.typeId}
        sheetRef={typeSheetRef}
        title="Chọn loại yêu cầu"
        onSelect={(id) => onChange({ typeId: id })}
      />
    </FlowScreen>
  );
}

function SelectTriggerRow({
  label,
  isPlaceholder,
  disabled = false,
  onPress,
}: {
  label: string;
  isPlaceholder: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-[46px] flex-row items-center justify-between gap-2 rounded-xl border border-border-default bg-bg-subtle px-4 py-3 ${
        disabled ? 'opacity-50' : ''
      }`}
      disabled={disabled}
      onPress={onPress}
    >
      <Text
        className={`flex-1 text-body ${
          isPlaceholder ? 'text-text-placeholder' : 'text-text-primary'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
      <CaretDown color={colors.semantic.textSecondary} size={16} weight="bold" />
    </Pressable>
  );
}

function OptionPickerSheet({
  sheetRef,
  title,
  options,
  selectedId,
  onSelect,
}: {
  sheetRef: RefObject<BottomSheetModal | null>;
  title: string;
  options: { id: string; label: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderCoatBackdrop}
      backgroundStyle={{ backgroundColor: colors.semantic.bgCard }}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: colors.neutral[300] }}
      snapPoints={['48%']}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 16) + 12,
          gap: 8,
        }}
      >
        <Text className="mb-1 text-title-sm font-bold text-text-primary">{title}</Text>
        {options.map((opt) => {
          const isSelected = opt.id === selectedId;
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              className={`flex-row items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 ${
                isSelected
                  ? 'border-border-selected bg-secondary-0'
                  : 'border-border-default bg-bg-subtle'
              }`}
              onPress={() => {
                onSelect(opt.id);
                sheetRef.current?.dismiss();
              }}
            >
              <Text
                className={`flex-1 text-body ${
                  isSelected ? 'font-semibold text-text-primary' : 'text-text-primary'
                }`}
              >
                {opt.label}
              </Text>
              {isSelected ? (
                <Check color={colors.semantic.actionPrimary} size={18} weight="bold" />
              ) : null}
            </Pressable>
          );
        })}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
