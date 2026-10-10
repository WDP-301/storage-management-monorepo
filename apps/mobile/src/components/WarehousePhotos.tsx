import { Images } from 'phosphor-react-native';
import { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { WarehouseImage } from '../types/storage-api';

/** Mirror the colour tokens in global.css; SVG icons cannot read a Tailwind class. */
const ON_IMAGE = 'hsl(0 0% 100%)';
const MUTED = 'hsl(215 16% 47%)';

/**
 * The cover photo across the top of a warehouse card. Renders nothing for a warehouse without
 * photos so those cards keep their compact layout.
 */
export function WarehouseCover({
  images,
  name,
  onPress,
}: {
  images: readonly WarehouseImage[];
  name: string;
  onPress: () => void;
}) {
  const cover = images[0];
  if (!cover) return null;

  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`Xem chi tiết và ${images.length} ảnh kho ${name}`}
      onPress={onPress}
    >
      <Image source={{ uri: cover.url }} className="h-40 w-full rounded-lg" resizeMode="cover" />
      {images.length > 1 ? (
        <View className="absolute bottom-2 right-2 flex-row items-center gap-1 rounded-full bg-black/60 px-2 py-0.5">
          <Images color={ON_IMAGE} size={12} weight="fill" />
          <Text className="font-ui text-caption text-white">{images.length}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Full-width swipeable photos for the warehouse detail page, with a counter and a thumbnail row
 * to jump to any photo; tapping a photo opens it full screen.
 */
export function WarehouseGallery({ images }: { images: readonly WarehouseImage[] }) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<WarehouseImage>>(null);
  const [index, setIndex] = useState(0);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <View className="h-56 items-center justify-center gap-2 bg-surface-secondary">
        <Images color={MUTED} size={32} />
        <Text className="font-body text-body-sm text-muted">Kho chưa có ảnh</Text>
      </View>
    );
  }

  const jumpTo = (next: number) => {
    setIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  };

  return (
    <View className="gap-2">
      <View>
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(image) => image.fileKey}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel={`Phóng to ảnh ${i + 1}/${images.length}`}
              onPress={() => setViewingIndex(i)}
            >
              <Image
                source={{ uri: item.url }}
                style={{ width }}
                className="h-64"
                resizeMode="cover"
              />
            </Pressable>
          )}
        />
        <View className="absolute bottom-2 right-3 rounded-full bg-black/60 px-2.5 py-0.5">
          <Text className="font-ui text-caption text-white">
            {index + 1}/{images.length}
          </Text>
        </View>
      </View>
      {images.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2 px-4">
            {images.map((image, i) => (
              <Pressable
                key={image.fileKey}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Ảnh ${i + 1}/${images.length}`}
                accessibilityState={{ selected: i === index }}
                onPress={() => jumpTo(i)}
              >
                <Image
                  source={{ uri: image.url }}
                  className={`size-16 rounded-md ${i === index ? 'border-2 border-accent' : 'opacity-60'}`}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}
      <WarehousePhotoViewer
        images={images}
        startIndex={viewingIndex}
        onClose={() => setViewingIndex(null)}
      />
    </View>
  );
}

/** Every photo in a swipeable row, for the warehouse detail sheet. */
export function WarehousePhotoStrip({ images }: { images: readonly WarehouseImage[] }) {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  if (images.length === 0) return null;

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {images.map((image, index) => (
            <Pressable
              key={image.fileKey}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Ảnh ${index + 1}/${images.length}`}
              onPress={() => setViewingIndex(index)}
            >
              <Image
                source={{ uri: image.url }}
                className="h-36 w-56 rounded-lg"
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <WarehousePhotoViewer
        images={images}
        startIndex={viewingIndex}
        onClose={() => setViewingIndex(null)}
      />
    </>
  );
}

function WarehousePhotoViewer({
  images,
  startIndex,
  onClose,
}: {
  images: readonly WarehouseImage[];
  startIndex: number | null;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  return (
    <Modal
      visible={startIndex !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => setIndex(startIndex ?? 0)}
    >
      <View className="flex-1 bg-black/95">
        <FlatList
          data={images}
          keyExtractor={(image) => image.fileKey}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <Pressable style={{ width }} className="flex-1 justify-center" onPress={onClose}>
              <Image source={{ uri: item.url }} className="h-4/5 w-full" resizeMode="contain" />
            </Pressable>
          )}
        />
        <Text className="font-body absolute inset-x-0 bottom-12 text-center text-body-sm text-white">
          {index + 1}/{images.length} · Chạm để đóng
        </Text>
      </View>
    </Modal>
  );
}
