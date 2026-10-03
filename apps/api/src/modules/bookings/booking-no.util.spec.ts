import { extractBookingNos, generateBookingNo } from './booking-no.util';

describe('booking-no.util', () => {
  const BOOKING_NO = 'BK-1790760804609-6618';

  describe('generateBookingNo', () => {
    it('produces a number that round-trips through extractBookingNos', () => {
      const generated = generateBookingNo();

      expect(generated).toMatch(/^BK-\d{13}-[0-9A-F]{4}$/);
      expect(extractBookingNos(generated)).toEqual([generated]);
    });
  });

  describe('extractBookingNos', () => {
    it.each([
      ['canonical form', 'BK-1790760804609-6618'],
      ['separators stripped by bank', 'BK17907608046096618'],
      ['spaces instead of dashes', 'BK 1790760804609 6618'],
      ['dots and underscores', 'BK.1790760804609_6618'],
      ['lowercase', 'bk-1790760804609-6618'],
      [
        'embedded in bank content',
        'MBVCB.1234567.NGUYEN VAN A chuyen tien BK17907608046096618.CT tu 0123',
      ],
      ['followed directly by text', 'BK17907608046096618 thanh toan coc'],
      ['SePay test transfer content', 'Giao dich thu nghiem BK-1790760804609-6618'],
      ['SePay test transfer content without dashes', 'Giao dich thu nghiem BK17907608046096618'],
    ])('extracts from %s', (_label, content) => {
      expect(extractBookingNos(content)).toEqual([BOOKING_NO]);
    });

    it('normalizes lowercase hex suffix to uppercase', () => {
      expect(extractBookingNos('bk-1790760890263-c2c3')).toEqual(['BK-1790760890263-C2C3']);
    });

    it.each([
      ['plain text', 'chuyen tien an trua'],
      ['empty string', ''],
      ['null', null],
      ['undefined', undefined],
    ])('returns empty for %s', (_label, content) => {
      expect(extractBookingNos(content)).toEqual([]);
    });

    it('does not match an incomplete timestamp', () => {
      expect(extractBookingNos('BK-179076080460-6618')).toEqual([]);
    });

    it('dedupes the same booking repeated in different forms', () => {
      expect(extractBookingNos(`BK17907608046096618 CT ${BOOKING_NO}`)).toEqual([BOOKING_NO]);
    });

    it('returns every distinct booking number in order of appearance', () => {
      expect(extractBookingNos('BK-1790760804609-6618 va BK-1790760890263-C2C3')).toEqual([
        BOOKING_NO,
        'BK-1790760890263-C2C3',
      ]);
    });
  });
});
