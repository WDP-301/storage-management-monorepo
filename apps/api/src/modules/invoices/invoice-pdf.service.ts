import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { buildPaymentQrUrl } from '@modules/payments/vietqr.util';
import { UploadService } from '@modules/upload/upload.service';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV_KEY } from '@shared/constants';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

/** Helper to remove diacritics for standard PDF Helvetica font fallback */
export function sanitizePdfText(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
    .trim();
}

export function formatVndCurrency(amount: number | string): string {
  const num = Number(amount);
  return `${new Intl.NumberFormat('vi-VN').format(Number.isFinite(num) ? num : 0)} VND`;
}

export function formatDateStr(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function resolveFontPaths(): { regular: string | null; bold: string | null } {
  const candidatesRegular = [
    path.resolve(__dirname, '../../assets/fonts/Roboto-Regular.ttf'),
    path.resolve(__dirname, '../../../src/assets/fonts/Roboto-Regular.ttf'),
    path.resolve(process.cwd(), 'src/assets/fonts/Roboto-Regular.ttf'),
    path.resolve(process.cwd(), 'apps/api/src/assets/fonts/Roboto-Regular.ttf'),
    'C:/Windows/Fonts/arial.ttf',
  ];
  const candidatesBold = [
    path.resolve(__dirname, '../../assets/fonts/Roboto-Bold.ttf'),
    path.resolve(__dirname, '../../../src/assets/fonts/Roboto-Bold.ttf'),
    path.resolve(process.cwd(), 'src/assets/fonts/Roboto-Bold.ttf'),
    path.resolve(process.cwd(), 'apps/api/src/assets/fonts/Roboto-Bold.ttf'),
    'C:/Windows/Fonts/arialbd.ttf',
  ];

  const regular = candidatesRegular.find((p) => fs.existsSync(p)) ?? null;
  const bold = candidatesBold.find((p) => fs.existsSync(p)) ?? null;
  return { regular, bold };
}

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Generates a PDF buffer for the invoice and uploads it to S3, returning the public URL.
   */
  async generateAndUpload(invoice: Invoice, items: InvoiceItem[] = []): Promise<string> {
    const pdfBuffer = await this.renderPdfBuffer(invoice, items);
    const fileKey = `uploads/invoices/INV-${invoice.invoiceNo}.pdf`;

    const uploadRes = await this.uploadService.uploadBuffer(fileKey, pdfBuffer, 'application/pdf');

    this.logger.log(
      `Invoice PDF uploaded successfully for ${invoice.invoiceNo}: ${uploadRes.publicUrl}`,
    );
    return uploadRes.publicUrl;
  }

  /**
   * Renders the invoice into an in-memory PDF Buffer with minimalist black & white design (VietQR colored).
   */
  async renderPdfBuffer(invoice: Invoice, items: InvoiceItem[] = []): Promise<Buffer> {
    const bankId = this.configService.get<string>(ENV_KEY.SEPAY_BANK_ID, '');
    const accountNo = this.configService.get<string>(ENV_KEY.SEPAY_ACCOUNT_NO, '');
    const accountName = this.configService.get<string>(ENV_KEY.SEPAY_ACCOUNT_NAME, '');
    const qrUrl = buildPaymentQrUrl(this.configService, invoice.total, invoice.invoiceNo);

    let qrBuffer: Buffer | null = null;
    if (qrUrl) {
      try {
        const qrRes = await fetch(qrUrl);
        if (qrRes.ok) {
          qrBuffer = Buffer.from(await qrRes.arrayBuffer());
        }
      } catch (e: any) {
        this.logger.warn(`Could not fetch QR image for PDF: ${e?.message || e}`);
      }
    }

    const fontPaths = resolveFontPaths();
    const hasCustomFont = Boolean(fontPaths.regular);
    const fontRegular = hasCustomFont ? 'CustomFont' : 'Helvetica';
    const fontBold = fontPaths.bold ? 'CustomFont-Bold' : 'Helvetica-Bold';

    // When custom font is loaded, keep full Vietnamese diacritics. Otherwise fallback to sanitized ASCII.
    const t = (text: string | null | undefined): string => {
      if (!text) return '';
      return hasCustomFont ? text : sanitizePdfText(text);
    };

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 45,
          info: {
            Title: `Hóa đơn ${invoice.invoiceNo}`,
            Author: 'Hệ thống Quản lý Lưu trữ Kho',
          },
        });

        if (fontPaths.regular) doc.registerFont('CustomFont', fontPaths.regular);
        if (fontPaths.bold) doc.registerFont('CustomFont-Bold', fontPaths.bold);

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        // ==========================================
        // 1. HEADER (TRẮNG ĐEN TỐI GIẢN)
        // ==========================================
        const pageLeft = 45;
        const pageRight = 550;
        const pageWidth = pageRight - pageLeft;

        // Brand / Top Bar
        doc
          .font(fontBold)
          .fontSize(10)
          .fillColor('#000000')
          .text(t('HỆ THỐNG QUẢN LÝ LƯU TRỮ KHO'), pageLeft, 45);
        doc
          .font(fontRegular)
          .fontSize(8)
          .fillColor('#666666')
          .text('Storage Management System', pageLeft, 58);

        // Title
        doc
          .font(fontBold)
          .fontSize(18)
          .fillColor('#000000')
          .text(t('HÓA ĐƠN TIỀN THUÊ KHO'), pageLeft, 82);

        // Status Box (Top Right - Minimalist Outline)
        const isPaid = invoice.status === 'PAID';
        const statusText = isPaid ? t('ĐÃ THANH TOÁN') : t('CHƯA THANH TOÁN');

        doc
          .roundedRect(pageRight - 110, 80, 110, 22, 2)
          .strokeColor('#000000')
          .lineWidth(1)
          .stroke();
        doc
          .font(fontBold)
          .fontSize(8.5)
          .fillColor('#000000')
          .text(statusText, pageRight - 110, 86, {
            width: 110,
            align: 'center',
          });

        // Thin black divider line
        doc
          .moveTo(pageLeft, 115)
          .lineTo(pageRight, 115)
          .strokeColor('#000000')
          .lineWidth(1)
          .stroke();

        // ==========================================
        // 2. METADATA SECTION (2 CỘT TỐI GIẢN TRẮNG ĐEN)
        // ==========================================
        const metaY = 130;

        // Cột trái: Thông tin hóa đơn
        doc
          .font(fontBold)
          .fontSize(9.5)
          .fillColor('#000000')
          .text(t('CHI TIẾT HÓA ĐƠN'), pageLeft, metaY);

        doc.font(fontRegular).fontSize(9).fillColor('#444444');
        doc.text(t('Mã hóa đơn:'), pageLeft, metaY + 18);
        doc
          .font(fontBold)
          .fillColor('#000000')
          .text(invoice.invoiceNo, pageLeft + 85, metaY + 18);

        doc
          .font(fontRegular)
          .fillColor('#444444')
          .text(t('Ngày phát hành:'), pageLeft, metaY + 33);
        doc
          .font(fontRegular)
          .fillColor('#000000')
          .text(formatDateStr(invoice.issuedAt ?? invoice.createdAt), pageLeft + 85, metaY + 33);

        doc
          .font(fontRegular)
          .fillColor('#444444')
          .text(t('Hạn thanh toán:'), pageLeft, metaY + 48);
        doc
          .font(fontBold)
          .fillColor('#000000')
          .text(formatDateStr(invoice.dueAt), pageLeft + 85, metaY + 48);

        if (invoice.contract) {
          doc
            .font(fontRegular)
            .fillColor('#444444')
            .text(t('Số hợp đồng:'), pageLeft, metaY + 63);
          doc
            .font(fontRegular)
            .fillColor('#000000')
            .text(invoice.contract.contractNo, pageLeft + 85, metaY + 63);
        }

        // Cột phải: Thông tin khách hàng
        const colRightX = pageLeft + 265;
        doc
          .font(fontBold)
          .fontSize(9.5)
          .fillColor('#000000')
          .text(t('KHÁCH HÀNG'), colRightX, metaY);

        const customerName = invoice.customer?.fullName || 'Khách hàng';
        doc.font(fontRegular).fontSize(9).fillColor('#444444');
        doc.text(t('Họ và tên:'), colRightX, metaY + 18);
        doc
          .font(fontBold)
          .fillColor('#000000')
          .text(t(customerName), colRightX + 65, metaY + 18);

        doc
          .font(fontRegular)
          .fillColor('#444444')
          .text(t('Điện thoại:'), colRightX, metaY + 33);
        doc
          .font(fontRegular)
          .fillColor('#000000')
          .text(invoice.customer?.phone || 'N/A', colRightX + 65, metaY + 33);

        doc
          .font(fontRegular)
          .fillColor('#444444')
          .text(t('Email:'), colRightX, metaY + 48);
        doc
          .font(fontRegular)
          .fillColor('#000000')
          .text(invoice.customer?.email || 'N/A', colRightX + 65, metaY + 48);

        doc
          .font(fontRegular)
          .fillColor('#444444')
          .text(t('Kỳ hạn thuê:'), colRightX, metaY + 63);
        doc
          .font(fontRegular)
          .fillColor('#000000')
          .text(
            t(`Kỳ ${invoice.periodNo} (${invoice.months || 1} tháng)`),
            colRightX + 65,
            metaY + 63,
          );

        // ==========================================
        // 3. BẢNG CHI TIẾT DỊCH VỤ (TABLE TRẮNG ĐEN)
        // ==========================================
        const tableY = 230;
        doc
          .moveTo(pageLeft, tableY)
          .lineTo(pageRight, tableY)
          .strokeColor('#000000')
          .lineWidth(1)
          .stroke();

        // Header Table
        doc.font(fontBold).fontSize(8.5).fillColor('#000000');
        doc.text(t('KHOẢN MỤC DỊCH VỤ'), pageLeft, tableY + 7);
        doc.text(t('SỐ LƯỢNG'), pageLeft + 250, tableY + 7);
        doc.text(t('ĐƠN GIÁ / THÁNG'), pageLeft + 330, tableY + 7);
        doc.text(t('THÀNH TIỀN'), pageRight - 85, tableY + 7, { width: 85, align: 'right' });

        doc
          .moveTo(pageLeft, tableY + 22)
          .lineTo(pageRight, tableY + 22)
          .strokeColor('#000000')
          .lineWidth(0.5)
          .stroke();

        const lineItems =
          items.length > 0
            ? items
            : [
                {
                  description: `Tiền thuê kho kỳ ${invoice.periodNo}`,
                  quantity: invoice.months || 1,
                  unitAmount: invoice.monthlyPriceSnapshot || invoice.total,
                  amount: invoice.total,
                } as InvoiceItem,
              ];

        let currentY = tableY + 30;
        lineItems.forEach((item) => {
          doc.font(fontRegular).fontSize(9).fillColor('#000000');
          doc.text(t(item.description), pageLeft, currentY, { width: 235 });
          doc.text(`${item.quantity} ${t('tháng')}`, pageLeft + 250, currentY);
          doc.text(formatVndCurrency(item.unitAmount), pageLeft + 330, currentY);
          doc.font(fontBold).text(formatVndCurrency(item.amount), pageRight - 85, currentY, {
            width: 85,
            align: 'right',
          });
          currentY += 22;
          doc
            .moveTo(pageLeft, currentY)
            .lineTo(pageRight, currentY)
            .strokeColor('#E5E5E5')
            .lineWidth(0.5)
            .stroke();
        });

        // ==========================================
        // 4. TỔNG CỘNG TIỀN (TRẮNG ĐEN)
        // ==========================================
        currentY += 10;
        doc
          .moveTo(pageLeft + 200, currentY)
          .lineTo(pageRight, currentY)
          .strokeColor('#000000')
          .lineWidth(1)
          .stroke();
        currentY += 8;

        doc.font(fontBold).fontSize(9.5).fillColor('#000000');
        doc.text(t('TỔNG CỘNG TIỀN PHẢI THANH TOÁN:'), pageLeft + 120, currentY, {
          width: 250,
          align: 'right',
        });
        doc.font(fontBold).fontSize(12).fillColor('#000000');
        doc.text(formatVndCurrency(invoice.total), pageRight - 120, currentY - 2, {
          width: 120,
          align: 'right',
        });

        // ==========================================
        // 5. KHUNG THANH TOÁN & MÃ VIETQR (DỌC XUỐNG DƯỚI, PHÓNG TO NỔI BẬT)
        // ==========================================
        const payBoxY = Math.max(currentY + 20, 315);
        const qrSize = 225;
        const boxHeight = qrBuffer ? 375 : 135;

        // Clean white card with subtle outline
        doc
          .roundedRect(pageLeft, payBoxY, pageWidth, boxHeight, 4)
          .strokeColor('#CCCCCC')
          .lineWidth(0.75)
          .stroke();

        // Payment Info (Top of the box)
        const infoX = pageLeft + 16;
        const infoY = payBoxY + 12;

        doc
          .font(fontBold)
          .fontSize(9.5)
          .fillColor('#000000')
          .text(t('HƯỚNG DẪN THANH TOÁN CHUYỂN KHOẢN'), infoX, infoY);

        doc.font(fontRegular).fontSize(8.5).fillColor('#444444');
        doc
          .text(t('• Ngân hàng thụ hưởng:'), infoX, infoY + 18)
          .font(fontBold)
          .fillColor('#000000')
          .text(bankId || t('Chưa cấu hình'), infoX + 115, infoY + 18);

        doc
          .font(fontRegular)
          .fillColor('#444444')
          .text(t('• Số tài khoản:'), infoX, infoY + 32)
          .font(fontBold)
          .fillColor('#000000')
          .text(accountNo || t('Chưa cấu hình'), infoX + 115, infoY + 32);

        doc
          .font(fontRegular)
          .fillColor('#444444')
          .text(t('• Chủ tài khoản:'), infoX, infoY + 46)
          .font(fontBold)
          .fillColor('#000000')
          .text(t(accountName || 'Chưa cấu hình'), infoX + 115, infoY + 46);

        doc
          .font(fontRegular)
          .fillColor('#444444')
          .text(t('• Số tiền:'), infoX, infoY + 60)
          .font(fontBold)
          .fillColor('#000000')
          .text(formatVndCurrency(invoice.total), infoX + 115, infoY + 60);

        doc
          .font(fontRegular)
          .fillColor('#444444')
          .text(t('• Nội dung chuyển khoản:'), infoX, infoY + 74)
          .font(fontBold)
          .fillColor('#000000')
          .text(invoice.invoiceNo, infoX + 115, infoY + 74);

        doc.font(fontRegular).fontSize(8).fillColor('#777777');
        doc.text(
          t(
            '(Vui lòng quét mã VietQR bên dưới hoặc nhập chính xác nội dung để hệ thống tự động gạch nợ)',
          ),
          infoX,
          infoY + 90,
        );

        // QR Code (Centered horizontally below payment details - RETAINS FULL COLOR & EXTRA LARGE)
        if (qrBuffer) {
          try {
            // Subtle horizontal divider line inside box
            doc
              .moveTo(pageLeft + 16, infoY + 106)
              .lineTo(pageRight - 16, infoY + 106)
              .strokeColor('#EEEEEE')
              .lineWidth(0.5)
              .stroke();

            const qrX = pageLeft + Math.round((pageWidth - qrSize) / 2);
            const qrY = infoY + 114;
            doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

            doc
              .font(fontRegular)
              .fontSize(7.5)
              .fillColor('#888888')
              .text(
                t('Quét mã để thanh toán nhanh qua ứng dụng ngân hàng'),
                pageLeft,
                qrY + qrSize + 6,
                {
                  width: pageWidth,
                  align: 'center',
                },
              );
          } catch (e: any) {
            this.logger.warn(`Could not render QR code into PDF: ${e?.message || e}`);
          }
        }

        // ==========================================
        // 6. FOOTER
        // ==========================================
        doc
          .font(fontRegular)
          .fontSize(8)
          .fillColor('#888888')
          .text(
            t(
              'Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ! Mọi thắc mắc xin vui lòng liên hệ bộ phận CSKH.',
            ),
            pageLeft,
            765,
            { align: 'center', width: pageWidth },
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
