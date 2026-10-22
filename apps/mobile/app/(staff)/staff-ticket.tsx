import { TicketStatus } from '@storage/types';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler } from 'react-native';
import { useSession } from '../../lib/session';
import { registerLeaveGuard } from '../../src/features/staff/leave-guard';
import { pickImages } from '../../src/features/staff/pick-files';
import {
  type FinishDraft,
  StaffTicketDetailScreen,
} from '../../src/features/staff/StaffTicketDetailScreen';
import { MAX_FINISH_PHOTOS } from '../../src/features/staff/TicketFinishForm';
import { ticketActions } from '../../src/features/staff/ticket-actions';
import { useStaffTicket } from '../../src/features/staff/use-staff-ticket';

export default function StaffTicketRoute() {
  const router = useRouter();
  const { user } = useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { ticket, isLoading, isSaving, error, reload, update } = useStaffTicket(id);
  const [draft, setDraft] = useState<FinishDraft | null>(null);

  // A typed note or picked photos would be lost by leaving — the tab bar and back button ask first.
  const hasUnsavedWork =
    isSaving || (draft !== null && (draft.note.trim().length > 0 || draft.photos.length > 0));
  const unsavedRef = useRef(hasUnsavedWork);
  useEffect(() => {
    unsavedRef.current = hasUnsavedWork;
  }, [hasUnsavedWork]);
  useFocusEffect(useCallback(() => registerLeaveGuard(() => unsavedRef.current), []));

  // Leaving the screen — confirmed discard included — drops the draft; the route stays mounted,
  // so otherwise a discarded note would come back on the next visit.
  useFocusEffect(useCallback(() => () => setDraft(null), []));
  // A different ticket never inherits the previous one's draft, even without a blur in between.
  useEffect(() => {
    if (id) setDraft(null);
  }, [id]);

  const goBack = useCallback(() => router.navigate('/(staff)/requests'), [router]);
  const confirmLeave = useCallback(() => {
    if (!unsavedRef.current) return goBack();
    Alert.alert('Bỏ thay đổi?', 'Ghi chú hoặc ảnh chưa gửi sẽ không được giữ lại.', [
      { text: 'Ở lại', style: 'cancel' },
      { text: 'Bỏ thay đổi', style: 'destructive', onPress: goBack },
    ]);
  }, [goBack]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        confirmLeave();
        return true;
      });
      return () => sub.remove();
    }, [confirmLeave]),
  );

  if (!id) return <Redirect href="/(staff)/requests" />;

  const actions = ticket
    ? ticketActions(ticket, {
        userId: user?.id,
        isManager: user?.roles.includes('FACILITY_MANAGER') ?? false,
      })
    : { canStart: false, canResolve: false, canClose: false, hint: null };

  const addPhotos = async (source: 'camera' | 'library') => {
    if (!draft) return;
    const picked = await pickImages(source, MAX_FINISH_PHOTOS - draft.photos.length);
    if (picked.length === 0) return;
    setDraft((prev) =>
      prev ? { ...prev, photos: [...prev.photos, ...picked].slice(0, MAX_FINISH_PHOTOS) } : prev,
    );
  };

  const submitFinish = async () => {
    if (!draft) return;
    const submitted = draft;
    const done = await update(
      {
        status: draft.mode === 'resolve' ? TicketStatus.RESOLVED : TicketStatus.CLOSED,
        resolution: draft.note.trim(),
      },
      draft.photos,
    );
    // Only clear the draft that was sent — the user may have left and started a new one meanwhile.
    if (done) setDraft((current) => (current === submitted ? null : current));
  };

  return (
    <StaffTicketDetailScreen
      ticket={ticket}
      actions={actions}
      sessionUserId={user?.id}
      isLoading={isLoading}
      isSaving={isSaving}
      error={error}
      draft={draft}
      onStart={() => void update({ status: TicketStatus.IN_PROGRESS })}
      onOpenFinish={(mode) => setDraft({ mode, note: ticket?.resolution ?? '', photos: [] })}
      onChangeDraft={(patch) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
      onAddPhotos={(source) => void addPhotos(source)}
      onSubmitFinish={() => void submitFinish()}
      onCancelFinish={() => setDraft(null)}
      onRetry={() => void reload()}
      onBack={confirmLeave}
    />
  );
}
