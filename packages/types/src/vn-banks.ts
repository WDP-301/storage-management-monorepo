/** A bank or e-wallet that accepts VietQR transfers. */
export interface VnBank {
  /** 6-digit NAPAS BIN — what a VietQR code identifies the bank by. */
  bin: string;
  /** Brand customers recognise, e.g. "Vietcombank". */
  shortName: string;
  /** Registered legal name. */
  name: string;
}

/**
 * Every bank in the VietQR directory (https://api.vietqr.io/v2/banks, 76 entries as of
 * 2026-10-21), in the directory's own order. A bank missing here is entered as "other" with a
 * free-text name and no BIN, so a stale copy never blocks a refund.
 */
export const VN_BANKS: readonly VnBank[] = [
  { bin: '970415', shortName: 'VietinBank', name: 'Ngân hàng TMCP Công thương Việt Nam' },
  { bin: '970436', shortName: 'Vietcombank', name: 'Ngân hàng TMCP Ngoại Thương Việt Nam' },
  { bin: '970418', shortName: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam' },
  {
    bin: '970405',
    shortName: 'Agribank',
    name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam',
  },
  { bin: '970448', shortName: 'OCB', name: 'Ngân hàng TMCP Phương Đông' },
  { bin: '970422', shortName: 'MBBank', name: 'Ngân hàng TMCP Quân đội' },
  { bin: '970407', shortName: 'Techcombank', name: 'Ngân hàng TMCP Kỹ thương Việt Nam' },
  { bin: '970416', shortName: 'ACB', name: 'Ngân hàng TMCP Á Châu' },
  { bin: '970432', shortName: 'VPBank', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng' },
  { bin: '970423', shortName: 'TPBank', name: 'Ngân hàng TMCP Tiên Phong' },
  { bin: '970403', shortName: 'Sacombank', name: 'Ngân hàng TMCP Sài Gòn Tài Lộc' },
  { bin: '970437', shortName: 'HDBank', name: 'Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh' },
  { bin: '970454', shortName: 'VietCapitalBank', name: 'Ngân hàng TMCP Bản Việt' },
  { bin: '970429', shortName: 'SCB', name: 'Ngân hàng TMCP Sài Gòn' },
  { bin: '970441', shortName: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam' },
  { bin: '970443', shortName: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội' },
  { bin: '970431', shortName: 'Eximbank', name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam' },
  { bin: '970426', shortName: 'MSB', name: 'Ngân hàng TMCP Hàng Hải' },
  {
    bin: '546034',
    shortName: 'CAKE',
    name: 'TMCP Việt Nam Thịnh Vượng - Ngân hàng số CAKE by VPBank',
  },
  {
    bin: '546035',
    shortName: 'Ubank',
    name: 'TMCP Việt Nam Thịnh Vượng - Ngân hàng số Ubank by VPBank',
  },
  {
    bin: '963388',
    shortName: 'Timo',
    name: 'Ngân hàng số Timo by Ban Viet Bank (Timo by Ban Viet Bank)',
  },
  {
    bin: '971005',
    shortName: 'ViettelMoney',
    name: 'Tổng Công ty Dịch vụ số Viettel - Chi nhánh tập đoàn công nghiệp viễn thông Quân Đội',
  },
  {
    bin: '971011',
    shortName: 'VNPTMoney',
    name: 'Trung tâm dịch vụ tài chính số VNPT- Chi nhánh Tổng công ty truyền thông (VNPT Fintech)',
  },
  { bin: '970400', shortName: 'SaigonBank', name: 'Ngân hàng TMCP Sài Gòn Công Thương' },
  { bin: '970409', shortName: 'BacABank', name: 'Ngân hàng TMCP Bắc Á' },
  { bin: '971133', shortName: 'PVcomBank Pay', name: 'Ngân hàng số PVcomBank' },
  { bin: '971025', shortName: 'MoMo', name: 'CTCP Dịch Vụ Di Động Trực Tuyến' },
  { bin: '970412', shortName: 'PVcomBank', name: 'Ngân hàng TMCP Đại Chúng Việt Nam' },
  { bin: '970414', shortName: 'MBV', name: 'Ngân hàng TNHH MTV Việt Nam Hiện Đại' },
  { bin: '970419', shortName: 'NCB', name: 'Ngân hàng TMCP Quốc Dân' },
  { bin: '970424', shortName: 'ShinhanBank', name: 'Ngân hàng TNHH MTV Shinhan Việt Nam' },
  { bin: '970425', shortName: 'ABBANK', name: 'Ngân hàng TMCP An Bình' },
  { bin: '970427', shortName: 'VietABank', name: 'Ngân hàng TMCP Việt Á' },
  { bin: '970428', shortName: 'NamABank', name: 'Ngân hàng TMCP Nam Á' },
  { bin: '970430', shortName: 'PGBank', name: 'Ngân hàng TMCP Thịnh vượng và Phát triển' },
  { bin: '970433', shortName: 'VietBank', name: 'Ngân hàng TMCP Việt Nam Thương Tín' },
  { bin: '970438', shortName: 'BaoVietBank', name: 'Ngân hàng TMCP Bảo Việt' },
  { bin: '970440', shortName: 'SeABank', name: 'Ngân hàng TMCP Đông Nam Á' },
  { bin: '970446', shortName: 'COOPBANK', name: 'Ngân hàng Hợp tác xã Việt Nam' },
  { bin: '970449', shortName: 'LPBank', name: 'Ngân hàng TMCP Lộc Phát Việt Nam' },
  { bin: '970452', shortName: 'KienLongBank', name: 'Ngân hàng TMCP Kiên Long' },
  { bin: '668888', shortName: 'KBank', name: 'Ngân hàng Đại chúng TNHH Kasikornbank' },
  {
    bin: '970466',
    shortName: 'KEBHanaHCM',
    name: 'Ngân hàng KEB Hana – Chi nhánh Thành phố Hồ Chí Minh',
  },
  { bin: '970467', shortName: 'KEBHANAHN', name: 'Ngân hàng KEB Hana – Chi nhánh Hà Nội' },
  { bin: '977777', shortName: 'MAFC', name: 'Công ty Tài chính TNHH MTV Mirae Asset (Việt Nam)' },
  { bin: '999888', shortName: 'VBSP', name: 'Ngân hàng Chính sách Xã hội' },
  { bin: '963668', shortName: 'BNP HN', name: 'Ngân hàng BNP Paribas – Chi nhánh Hà Nội' },
  {
    bin: '555666',
    shortName: 'BIDC',
    name: 'Ngân hàng Đầu Tư Và Phát Triển Campuchia - Chi nhánh Hà Nội',
  },
  {
    bin: '963666',
    shortName: 'BNP HCM',
    name: 'Ngân hàng BNP Paribas – Chi nhánh Thành phố Hồ Chí Minh',
  },
  { bin: '971101', shortName: 'ZaloPay', name: 'Ví điện tử ZaloPay' },
  {
    bin: '963688',
    shortName: 'BOCHK',
    name: 'Ngân hàng Bank of China (Hong Kong) Limited – Chi nhánh Hồ Chí Minh',
  },
  { bin: '970465', shortName: 'BSP', name: 'Ngân hàng SinoPac - Chi nhánh Thành phố Hồ Chí Minh' },
  {
    bin: '168999',
    shortName: 'CUBHCM',
    name: 'Ngân hàng Cathay United Bank – Chi nhánh Hồ Chí Minh',
  },
  {
    bin: '963686',
    shortName: 'ESUN',
    name: 'Ngân hàng Thương mại TNHH E.SUN – Chi nhánh Đồng Nai (ESUNBANK)',
  },
  {
    bin: '963669',
    shortName: 'ICBC',
    name: 'Ngân hàng Công thương Trung Quốc – Chi nhánh thành phố Hà Nội',
  },
  {
    bin: '971032',
    shortName: 'MVAS',
    name: 'Trung tâm Dịch vụ số Mobifone – Chi nhánh Tổng Công ty viễn thông Mobifone',
  },
  { bin: '963326', shortName: 'TNEX', name: 'TNEX by MSB' },
  { bin: '458761', shortName: 'HSBC', name: 'Ngân hàng TNHH MTV HSBC (Việt Nam)' },
  { bin: '970442', shortName: 'HongLeong', name: 'Ngân hàng TNHH MTV Hong Leong Việt Nam' },
  { bin: '970455', shortName: 'IBKHN', name: 'Ngân hàng Công nghiệp Hàn Quốc - Chi nhánh Hà Nội' },
  {
    bin: '970456',
    shortName: 'IBKHCM',
    name: 'Ngân hàng Công nghiệp Hàn Quốc - Chi nhánh TP. Hồ Chí Minh',
  },
  { bin: '970434', shortName: 'IndovinaBank', name: 'Ngân hàng TNHH Indovina' },
  { bin: '970406', shortName: 'Vikki', name: 'Ngân hàng TNHH Một thành viên số Vikki' },
  { bin: '801011', shortName: 'Nonghyup', name: 'Ngân hàng Nonghyup - Chi nhánh Hà Nội' },
  { bin: '796500', shortName: 'DBSBank', name: 'DBS Bank Ltd - Chi nhánh Thành phố Hồ Chí Minh' },
  { bin: '970439', shortName: 'PublicBank', name: 'Ngân hàng TNHH MTV Public Việt Nam' },
  {
    bin: '970410',
    shortName: 'StandardChartered',
    name: 'Ngân hàng TNHH MTV Standard Chartered Bank Việt Nam',
  },
  { bin: '533948', shortName: 'Citibank', name: 'Ngân hàng Citibank, N.A. - Chi nhánh Hà Nội' },
  { bin: '422589', shortName: 'CIMB', name: 'Ngân hàng TNHH MTV CIMB Việt Nam' },
  {
    bin: '970458',
    shortName: 'UnitedOverseas',
    name: 'Ngân hàng United Overseas - Chi nhánh TP. Hồ Chí Minh',
  },
  {
    bin: '970444',
    shortName: 'CBBank',
    name: 'Ngân hàng Thương mại trách nhiệm hữu hạn một thành viên Ngoại thương Công nghệ số (Vietcombank Neo Limited)',
  },
  { bin: '970408', shortName: 'GPBank', name: 'Ngân hàng Thương mại TNHH MTV Dầu Khí Toàn Cầu' },
  { bin: '970421', shortName: 'VRB', name: 'Ngân hàng Liên doanh Việt - Nga' },
  { bin: '970457', shortName: 'Woori', name: 'Ngân hàng TNHH MTV Woori Việt Nam' },
  { bin: '970462', shortName: 'KookminHN', name: 'Ngân hàng Kookmin - Chi nhánh Hà Nội' },
  {
    bin: '970463',
    shortName: 'KookminHCM',
    name: 'Ngân hàng Kookmin - Chi nhánh Thành phố Hồ Chí Minh',
  },
];

const BANKS_BY_BIN = new Map(VN_BANKS.map((bank) => [bank.bin, bank]));

/** The VietQR bank with this BIN, or undefined when it is not in the directory. */
export function findVnBank(bin: string): VnBank | undefined {
  return BANKS_BY_BIN.get(bin);
}
