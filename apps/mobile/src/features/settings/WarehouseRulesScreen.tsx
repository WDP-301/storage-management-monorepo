import { ScrollView, View } from 'react-native';
import { colors, FlowScreen, Icon, Text } from '../../components/ui';

type Props = {
  onBack: () => void;
};

type Clause = {
  no?: number;
  label?: string;
  text?: string;
  bullets?: string[];
};

type Article = {
  no: number;
  title: string;
  intro?: string;
  clauses: Clause[];
};

type Chapter = {
  no: string;
  title: string;
  articles: Article[];
};

const CHAPTERS: Chapter[] = [
  {
    no: 'I',
    title: 'Quy định chung',
    articles: [
      {
        no: 1,
        title: 'Mục đích và phạm vi áp dụng',
        clauses: [
          {
            no: 1,
            text: 'Quy định này được ban hành nhằm thiết lập các nguyên tắc, điều kiện và trách nhiệm của khách hàng và đơn vị cung cấp dịch vụ trong quá trình thuê, sử dụng và quản lý không gian lưu trữ hàng hóa tại hệ thống kho.',
          },
          {
            no: 2,
            text: 'Quy định áp dụng đối với tất cả khách hàng sử dụng dịch vụ lưu trữ, bao gồm cá nhân, hộ kinh doanh và tổ chức có nhu cầu lưu trữ tài sản, hàng hóa hoặc vật dụng cá nhân.',
          },
          {
            no: 3,
            text: 'Khi đăng ký sử dụng dịch vụ, khách hàng có trách nhiệm đọc, hiểu và đồng ý tuân thủ toàn bộ các điều khoản được quy định trong văn bản này, hợp đồng thuê kho và các chính sách liên quan.',
          },
          {
            no: 4,
            text: 'Đơn vị vận hành có quyền cập nhật, điều chỉnh quy định nhằm phù hợp với tình hình hoạt động thực tế. Mọi thay đổi quan trọng phải được thông báo đến khách hàng trước khi áp dụng.',
          },
        ],
      },
      {
        no: 2,
        title: 'Phân loại hình thức lưu trữ',
        intro: 'Hệ thống cung cấp hai hình thức lưu trữ chính:',
        clauses: [
          {
            label: '2.1. Kho tự quản (Self-storage)',
            bullets: [
              'Là hình thức khách hàng thuê một khu vực hoặc một khoang lưu trữ riêng biệt để tự quản lý tài sản.',
              'Khách hàng có quyền chủ động đưa hàng hóa vào, lấy hàng hóa ra, sắp xếp và quản lý tài sản trong phạm vi kho đã thuê.',
              'Khách hàng tự chịu trách nhiệm về việc bảo quản, kiểm soát số lượng và tình trạng tài sản của mình.',
              'Đơn vị vận hành chịu trách nhiệm duy trì cơ sở vật chất, đảm bảo điều kiện hoạt động chung của kho và hỗ trợ khách hàng khi phát sinh các sự cố liên quan đến hạ tầng hoặc an ninh.',
            ],
          },
          {
            label: '2.2. Kho kệ (Rack Storage)',
            bullets: [
              'Là hình thức lưu trữ trong đó hàng hóa được tiếp nhận, kiểm kê, sắp xếp và quản lý bởi nhân viên kho.',
              'Khách hàng không được tự ý đi vào khu vực lưu trữ hoặc trực tiếp lấy, di chuyển hàng hóa trên hệ thống kệ.',
              'Mọi hoạt động nhập kho, xuất kho, di chuyển và kiểm kê hàng hóa phải được thực hiện bởi nhân viên có thẩm quyền.',
              'Đơn vị vận hành chịu trách nhiệm quản lý và bảo quản hàng hóa trong thời gian hàng hóa được tiếp nhận và lưu giữ tại kho, theo phạm vi trách nhiệm được quy định trong hợp đồng.',
            ],
          },
        ],
      },
    ],
  },
  {
    no: 'II',
    title: 'Quy định đối với khách hàng',
    articles: [
      {
        no: 3,
        title: 'Cung cấp thông tin và đăng ký sử dụng dịch vụ',
        clauses: [
          {
            no: 1,
            text: 'Khách hàng phải cung cấp đầy đủ, chính xác và trung thực các thông tin cần thiết khi đăng ký sử dụng dịch vụ, bao gồm:',
            bullets: [
              'Họ và tên hoặc tên tổ chức.',
              'Số điện thoại liên hệ.',
              'Địa chỉ email.',
              'Địa chỉ thường trú hoặc địa chỉ đăng ký kinh doanh (nếu có).',
              'Thông tin giấy tờ tùy thân hoặc giấy tờ pháp lý theo yêu cầu hợp lý của đơn vị vận hành.',
              'Thông tin người đại diện hoặc người được ủy quyền (nếu có).',
            ],
          },
          {
            no: 2,
            text: 'Khách hàng có trách nhiệm cập nhật thông tin khi có sự thay đổi, đặc biệt là số điện thoại, email và thông tin người liên hệ.',
          },
          {
            no: 3,
            text: 'Khách hàng phải đảm bảo mình có quyền sở hữu, quyền sử dụng hoặc quyền hợp pháp để lưu trữ hàng hóa tại kho.',
          },
          {
            no: 4,
            text: 'Khách hàng chịu trách nhiệm đối với những thiệt hại phát sinh do việc cung cấp thông tin sai lệch, giả mạo hoặc cố tình che giấu thông tin quan trọng.',
          },
          {
            no: 5,
            text: 'Đơn vị vận hành có quyền từ chối cung cấp dịch vụ hoặc tạm dừng tiếp nhận hàng hóa nếu phát hiện thông tin đăng ký không hợp lệ hoặc có dấu hiệu vi phạm pháp luật.',
          },
        ],
      },
      {
        no: 4,
        title: 'Quy định về hàng hóa được phép lưu trữ',
        clauses: [
          {
            no: 1,
            text: 'Khách hàng chỉ được lưu trữ những hàng hóa, tài sản hợp pháp, có nguồn gốc rõ ràng và phù hợp với mục đích sử dụng của kho.',
          },
          {
            no: 2,
            text: 'Hàng hóa phải được đóng gói, bảo quản phù hợp với đặc tính của từng loại sản phẩm nhằm tránh hư hỏng, rò rỉ, phát sinh mùi hoặc gây ảnh hưởng đến các hàng hóa khác.',
          },
          {
            no: 3,
            text: 'Khách hàng không được phép lưu trữ:',
            bullets: [
              'Hàng hóa bị cấm lưu thông hoặc cấm lưu trữ theo quy định pháp luật.',
              'Chất dễ cháy, chất nổ, chất độc hại hoặc các vật liệu có nguy cơ gây mất an toàn.',
              'Hàng hóa có khả năng gây ô nhiễm, phát sinh mùi khó chịu hoặc thu hút côn trùng, động vật gây hại.',
              'Thực phẩm dễ hư hỏng, hàng hóa không đảm bảo vệ sinh hoặc có nguy cơ ảnh hưởng đến môi trường kho.',
              'Động vật sống, thực vật thuộc diện hạn chế hoặc các loại tài sản không phù hợp với điều kiện bảo quản của kho.',
              'Các tài sản khác mà đơn vị vận hành thông báo không đủ điều kiện tiếp nhận.',
            ],
          },
          {
            no: 4,
            text: 'Khách hàng phải thông báo chính xác về tính chất, số lượng và đặc điểm của hàng hóa khi thực hiện thủ tục gửi kho.',
          },
          {
            no: 5,
            text: 'Đơn vị vận hành có quyền từ chối tiếp nhận hoặc yêu cầu khách hàng đưa hàng hóa ra khỏi kho nếu phát hiện hàng hóa không đáp ứng điều kiện lưu trữ.',
          },
        ],
      },
      {
        no: 5,
        title: 'Quy định về sử dụng kho đúng mục đích',
        clauses: [
          {
            no: 1,
            text: 'Khách hàng chỉ được sử dụng kho theo đúng mục đích lưu trữ đã đăng ký và thỏa thuận trong hợp đồng.',
          },
          {
            no: 2,
            text: 'Không được sử dụng kho làm nơi sinh hoạt, cư trú, kinh doanh trực tiếp, sản xuất, chế biến hoặc thực hiện các hoạt động không phù hợp với chức năng của kho.',
          },
          {
            no: 3,
            text: 'Khách hàng không được tự ý thay đổi kết cấu, lắp đặt thiết bị, khoan đục tường, thay đổi hệ thống điện, nước hoặc thực hiện các hoạt động cải tạo kho khi chưa được đơn vị vận hành chấp thuận.',
          },
          {
            no: 4,
            text: 'Không được gây tiếng ồn quá mức, xả rác, gây mất vệ sinh hoặc thực hiện các hành vi làm ảnh hưởng đến hoạt động chung của kho.',
          },
          {
            no: 5,
            text: 'Khách hàng có trách nhiệm giữ gìn vệ sinh khu vực lưu trữ và tuân thủ các quy định về an toàn phòng cháy chữa cháy, an ninh và bảo vệ môi trường.',
          },
        ],
      },
      {
        no: 6,
        title: 'Quy định về chuyển nhượng và cho thuê lại',
        clauses: [
          {
            no: 1,
            text: 'Khách hàng không được tự ý chuyển nhượng quyền sử dụng kho, cho thuê lại toàn bộ hoặc một phần diện tích kho cho cá nhân, tổ chức khác khi chưa có sự đồng ý bằng văn bản của đơn vị vận hành.',
          },
          {
            no: 2,
            text: 'Khách hàng không được tự ý giao quyền quản lý, quyền truy cập hoặc quyền sử dụng kho cho người khác ngoài những người đã đăng ký hoặc được đơn vị vận hành chấp thuận.',
          },
          {
            no: 3,
            text: 'Trường hợp có nhu cầu thay đổi người đại diện, người được ủy quyền hoặc chuyển giao quyền sử dụng dịch vụ, khách hàng phải gửi yêu cầu đến đơn vị vận hành để được xem xét và xác nhận.',
          },
          {
            no: 4,
            text: 'Mọi hành vi cho thuê lại hoặc chuyển nhượng trái phép đều được xem là vi phạm quy định sử dụng dịch vụ và có thể dẫn đến việc chấm dứt hợp đồng.',
          },
        ],
      },
    ],
  },
  {
    no: 'III',
    title: 'Quy định riêng đối với kho tự quản',
    articles: [
      {
        no: 7,
        title: 'Trách nhiệm quản lý và bảo quản tài sản',
        clauses: [
          {
            no: 1,
            text: 'Đối với kho tự quản, khách hàng là người trực tiếp quản lý và chịu trách nhiệm bảo quản toàn bộ tài sản được lưu trữ bên trong khu vực kho đã thuê.',
          },
          {
            no: 2,
            text: 'Khách hàng có trách nhiệm:',
            bullets: [
              'Tự sắp xếp, phân loại và bố trí hàng hóa hợp lý.',
              'Tự kiểm soát số lượng và tình trạng tài sản.',
              'Chủ động khóa cửa kho sau mỗi lần ra vào.',
              'Không để tài sản lấn chiếm khu vực chung hoặc ảnh hưởng đến khoang lưu trữ khác.',
              'Tự chịu trách nhiệm đối với việc thất lạc tài sản do sơ suất trong quá trình quản lý của mình.',
            ],
          },
          {
            no: 3,
            text: 'Đơn vị vận hành không trực tiếp kiểm kê, quản lý số lượng hoặc giám sát từng tài sản bên trong kho tự quản.',
          },
          {
            no: 4,
            text: 'Khách hàng nên chủ động lập danh sách tài sản, ghi nhận hình ảnh và lưu giữ thông tin về giá trị tài sản để thuận tiện cho việc đối chiếu khi cần thiết.',
          },
        ],
      },
      {
        no: 8,
        title: 'Trách nhiệm của đơn vị vận hành đối với kho tự quản',
        clauses: [
          {
            no: 1,
            text: 'Đơn vị vận hành có trách nhiệm đảm bảo kho và các hạng mục cơ sở vật chất chung được duy trì trong điều kiện hoạt động phù hợp.',
          },
          {
            no: 2,
            text: 'Các trách nhiệm chính bao gồm:',
            bullets: [
              'Kiểm tra và bảo trì kết cấu kho, cửa kho, mái che và các hạng mục thuộc phạm vi quản lý.',
              'Hỗ trợ xử lý các vấn đề liên quan đến hệ thống điện, nước và các thiết bị kỹ thuật chung.',
              'Duy trì hệ thống camera giám sát và hệ thống an ninh chung trong phạm vi được trang bị.',
              'Tiếp nhận phản ánh và hỗ trợ khách hàng khi phát hiện các dấu hiệu bất thường liên quan đến kho.',
            ],
          },
          {
            no: 3,
            text: 'Đơn vị vận hành có trách nhiệm tiếp nhận thông báo và tổ chức kiểm tra, sửa chữa khi kho phát sinh tình trạng hư hỏng thuộc trách nhiệm bảo trì của mình.',
          },
          {
            no: 4,
            text: 'Đơn vị vận hành không có nghĩa vụ kiểm kê, theo dõi hoặc xác nhận tình trạng từng món hàng được khách hàng tự lưu trữ bên trong kho.',
          },
        ],
      },
      {
        no: 9,
        title: 'Xử lý trường hợp mất mát hoặc hư hỏng tài sản tại kho tự quản',
        clauses: [
          {
            no: 1,
            text: 'Khi phát hiện tài sản bị mất, thất lạc hoặc hư hỏng mà không xác định được nguyên nhân, khách hàng cần thông báo ngay cho đơn vị vận hành.',
          },
          {
            no: 2,
            text: 'Sau khi tiếp nhận thông báo, đơn vị vận hành có trách nhiệm:',
            bullets: [
              'Ghi nhận thông tin sự cố.',
              'Phối hợp với khách hàng kiểm tra tình trạng khu vực kho.',
              'Hỗ trợ trích xuất và kiểm tra dữ liệu camera trong phạm vi thời gian dữ liệu còn được lưu trữ.',
              'Kiểm tra hệ thống khóa, cửa kho và các dấu hiệu bất thường liên quan đến an ninh.',
              'Phối hợp xác minh nguyên nhân và lập biên bản sự việc khi cần thiết.',
            ],
          },
          {
            no: 3,
            text: 'Đối với trường hợp mất mát tài sản không rõ nguyên nhân, đơn vị vận hành có trách nhiệm hỗ trợ xác minh nhưng không mặc nhiên chịu trách nhiệm bồi thường, do khách hàng là người trực tiếp quản lý và kiểm soát tài sản trong kho.',
          },
          {
            no: 4,
            text: 'Tuy nhiên, nếu thiệt hại được xác định xuất phát từ lỗi của đơn vị vận hành, chẳng hạn như lỗi bảo trì cơ sở vật chất, lỗi hệ thống an ninh thuộc trách nhiệm quản lý hoặc hành vi vi phạm của nhân viên, đơn vị vận hành phải xem xét trách nhiệm và thực hiện bồi thường theo mức độ thiệt hại thực tế và thỏa thuận hợp đồng.',
          },
          {
            no: 5,
            text: 'Trường hợp không có đủ căn cứ xác định nguyên nhân hoặc trách nhiệm của các bên, hai bên phối hợp cung cấp thông tin, tài liệu và thực hiện các thủ tục cần thiết để xác minh sự việc.',
          },
        ],
      },
    ],
  },
  {
    no: 'IV',
    title: 'Quy định riêng đối với kho kệ',
    articles: [
      {
        no: 10,
        title: 'Quy trình tiếp nhận và nhập kho',
        clauses: [
          {
            no: 1,
            text: 'Hàng hóa được đưa vào kho kệ phải trải qua quy trình tiếp nhận do nhân viên kho thực hiện.',
          },
          {
            no: 2,
            text: 'Khi tiếp nhận hàng hóa, nhân viên kho có trách nhiệm:',
            bullets: [
              'Xác nhận thông tin khách hàng và yêu cầu lưu trữ.',
              'Kiểm tra số lượng, chủng loại và tình trạng bên ngoài của hàng hóa.',
              'Ghi nhận thông tin hàng hóa vào hệ thống quản lý kho.',
              'Chụp ảnh hoặc ghi nhận bằng chứng về tình trạng hàng hóa tại thời điểm tiếp nhận khi cần thiết.',
              'Sắp xếp hàng hóa vào vị trí kệ phù hợp.',
              'Cập nhật trạng thái nhập kho và thông báo xác nhận cho khách hàng.',
            ],
          },
          {
            no: 3,
            text: 'Khách hàng có trách nhiệm cung cấp thông tin chính xác về hàng hóa và thông báo trước nếu hàng hóa có đặc tính đặc biệt cần lưu ý trong quá trình bảo quản.',
          },
          {
            no: 4,
            text: 'Những hàng hóa có dấu hiệu hư hỏng, thiếu hụt hoặc không phù hợp với điều kiện lưu trữ phải được ghi nhận trước khi nhập kho.',
          },
          {
            no: 5,
            text: 'Việc nhập kho chỉ được xác nhận hoàn tất khi thông tin hàng hóa đã được ghi nhận đầy đủ trên hệ thống hoặc biên bản tiếp nhận.',
          },
        ],
      },
      {
        no: 11,
        title: 'Quy định về quyền truy cập kho kệ',
        clauses: [
          {
            no: 1,
            text: 'Khách hàng không được tự ý đi vào khu vực lưu trữ hàng hóa, khu vực đặt kệ hoặc các khu vực nội bộ dành riêng cho nhân viên kho.',
          },
          {
            no: 2,
            text: 'Mọi hoạt động tiếp cận, di chuyển, sắp xếp, kiểm tra hoặc lấy hàng hóa phải được thực hiện thông qua nhân viên có thẩm quyền.',
          },
          {
            no: 3,
            text: 'Khi có nhu cầu kiểm tra hoặc nhận lại hàng hóa, khách hàng phải gửi yêu cầu đến đơn vị vận hành theo quy trình xuất kho.',
          },
          {
            no: 4,
            text: 'Trường hợp khách hàng có nhu cầu trực tiếp quan sát hàng hóa, đơn vị vận hành có thể bố trí nhân viên hỗ trợ và giám sát trong phạm vi cho phép.',
          },
          {
            no: 5,
            text: 'Khách hàng không được tự ý sử dụng thiết bị, phương tiện hoặc công cụ của kho nếu chưa được nhân viên phụ trách đồng ý.',
          },
          {
            no: 6,
            text: 'Nhân viên kho có quyền từ chối quyền truy cập đối với những cá nhân không có thông tin xác thực hoặc không được khách hàng đăng ký, ủy quyền hợp lệ.',
          },
        ],
      },
      {
        no: 12,
        title: 'Trách nhiệm quản lý và bảo quản hàng hóa',
        clauses: [
          {
            no: 1,
            text: 'Đơn vị vận hành chịu trách nhiệm quản lý hàng hóa kể từ thời điểm hàng hóa được nhân viên kho tiếp nhận và xác nhận nhập kho thành công.',
          },
          {
            no: 2,
            text: 'Nhân viên kho có trách nhiệm:',
            bullets: [
              'Sắp xếp hàng hóa đúng vị trí được chỉ định.',
              'Tuân thủ quy trình bảo quản phù hợp với đặc tính hàng hóa.',
              'Theo dõi tình trạng lưu trữ và cập nhật các thay đổi liên quan đến hàng hóa.',
              'Không tự ý sử dụng, di chuyển hoặc mở bao bì hàng hóa nếu không có lý do nghiệp vụ hợp lệ.',
              'Đảm bảo hàng hóa được xuất kho đúng khách hàng và đúng thông tin yêu cầu.',
            ],
          },
          {
            no: 3,
            text: 'Đơn vị vận hành phải có biện pháp kiểm soát hoạt động ra vào khu vực kho, hạn chế việc tiếp cận trái phép và thực hiện kiểm tra định kỳ theo quy trình nội bộ.',
          },
          {
            no: 4,
            text: 'Mọi hoạt động di chuyển hàng hóa giữa các vị trí kệ phải được ghi nhận trên hệ thống để đảm bảo khả năng truy xuất lịch sử lưu trữ.',
          },
          {
            no: 5,
            text: 'Đơn vị vận hành không được tự ý sử dụng, trao đổi, chuyển nhượng hoặc định đoạt hàng hóa của khách hàng dưới bất kỳ hình thức nào.',
          },
        ],
      },
      {
        no: 13,
        title: 'Trách nhiệm khi xảy ra mất mát hoặc hư hỏng hàng hóa tại kho kệ',
        clauses: [
          {
            no: 1,
            text: 'Đơn vị vận hành chịu trách nhiệm đối với những mất mát hoặc hư hỏng hàng hóa phát sinh do lỗi chủ quan của đơn vị vận hành hoặc nhân viên trong quá trình tiếp nhận, quản lý, sắp xếp, di chuyển và bảo quản hàng hóa.',
          },
          {
            no: 2,
            text: 'Các trường hợp có thể phát sinh trách nhiệm bồi thường bao gồm:',
            bullets: [
              'Nhân viên làm mất hàng hóa trong quá trình quản lý hoặc di chuyển.',
              'Hàng hóa bị hư hỏng do thao tác bốc xếp, sắp xếp không đúng quy trình.',
              'Hàng hóa bị thất lạc do sai sót trong quá trình nhập kho hoặc xuất kho.',
              'Hàng hóa bị lấy nhầm hoặc giao nhầm cho khách hàng khác do lỗi quản lý.',
              'Hàng hóa bị hư hỏng do điều kiện bảo quản không đáp ứng yêu cầu đã cam kết.',
              'Hàng hóa bị mất do nhân viên có hành vi vi phạm hoặc do thiếu sót trong công tác kiểm soát an ninh thuộc trách nhiệm của đơn vị vận hành.',
            ],
          },
          {
            no: 3,
            text: 'Khi phát sinh sự cố, đơn vị vận hành phải:',
            bullets: [
              'Tiếp nhận thông báo từ khách hàng.',
              'Kiểm tra lịch sử nhập kho, xuất kho và di chuyển hàng hóa.',
              'Kiểm tra dữ liệu camera và các tài liệu liên quan.',
              'Phối hợp với nhân viên phụ trách để xác định nguyên nhân.',
              'Lập biên bản ghi nhận sự cố và xác định phạm vi thiệt hại.',
              'Thông báo kết quả xác minh và phương án xử lý cho khách hàng.',
            ],
          },
          {
            no: 4,
            text: 'Nếu xác định thiệt hại xuất phát từ lỗi của đơn vị vận hành hoặc nhân viên, đơn vị vận hành có trách nhiệm bồi thường theo giá trị thiệt hại thực tế, căn cứ vào chứng từ, thông tin hàng hóa, bằng chứng về giá trị tài sản và các thỏa thuận trong hợp đồng.',
          },
          {
            no: 5,
            text: 'Đối với hàng hóa đã có dấu hiệu hư hỏng trước khi nhập kho, hàng hóa bị ảnh hưởng bởi đặc tính tự nhiên của chính sản phẩm hoặc thiệt hại xuất phát từ việc khách hàng cung cấp thông tin không chính xác, trách nhiệm của các bên được xác định dựa trên nguyên nhân thực tế và thỏa thuận đã ký.',
          },
          {
            no: 6,
            text: 'Đơn vị vận hành không được tự ý từ chối trách nhiệm nếu có bằng chứng cho thấy thiệt hại xuất phát từ lỗi của mình.',
          },
        ],
      },
    ],
  },
  {
    no: 'V',
    title: 'Thanh toán và quản lý hợp đồng',
    articles: [
      {
        no: 14,
        title: 'Nghĩa vụ thanh toán',
        clauses: [
          {
            no: 1,
            text: 'Khách hàng có nghĩa vụ thanh toán đầy đủ tiền thuê kho, tiền đặt cọc và các khoản phí dịch vụ khác theo thỏa thuận trong hợp đồng.',
          },
          {
            no: 2,
            text: 'Các khoản phí có thể bao gồm:',
            bullets: [
              'Phí thuê kho hoặc phí lưu trữ hàng hóa.',
              'Phí dịch vụ phát sinh theo yêu cầu.',
              'Phí vận chuyển, bốc xếp hoặc xử lý hàng hóa (nếu có).',
              'Các khoản phí khác đã được hai bên thống nhất.',
            ],
          },
          {
            no: 3,
            text: 'Khách hàng phải thanh toán đúng thời hạn và phương thức đã đăng ký.',
          },
          {
            no: 4,
            text: 'Trường hợp khách hàng thanh toán chậm, đơn vị vận hành có quyền gửi thông báo nhắc thanh toán và yêu cầu khách hàng hoàn tất nghĩa vụ tài chính.',
          },
          {
            no: 5,
            text: 'Nếu khách hàng tiếp tục không thực hiện nghĩa vụ thanh toán sau thời hạn được thông báo, đơn vị vận hành có quyền áp dụng các biện pháp xử lý theo hợp đồng và quy định pháp luật.',
          },
          {
            no: 6,
            text: 'Mọi khoản phí phát sinh phải được thông báo rõ ràng, minh bạch và có căn cứ.',
          },
        ],
      },
      {
        no: 15,
        title: 'Gia hạn và chấm dứt dịch vụ',
        clauses: [
          {
            no: 1,
            text: 'Khách hàng có thể yêu cầu gia hạn thời gian thuê kho trước ngày hết hạn hợp đồng.',
          },
          {
            no: 2,
            text: 'Việc gia hạn chỉ có hiệu lực sau khi được đơn vị vận hành xác nhận và các bên thống nhất về thời gian, chi phí liên quan.',
          },
          {
            no: 3,
            text: 'Khách hàng có quyền yêu cầu chấm dứt dịch vụ theo thời hạn và điều kiện được quy định trong hợp đồng.',
          },
          {
            no: 4,
            text: 'Khi chấm dứt dịch vụ, khách hàng có trách nhiệm:',
            bullets: [
              'Hoàn tất các khoản phí còn thiếu.',
              'Lấy toàn bộ tài sản ra khỏi kho.',
              'Bàn giao lại kho trong tình trạng phù hợp với tình trạng ban đầu, ngoại trừ hao mòn tự nhiên.',
              'Hoàn trả chìa khóa, thẻ truy cập hoặc các thiết bị được bàn giao (nếu có).',
            ],
          },
          {
            no: 5,
            text: 'Đơn vị vận hành có quyền chấm dứt hợp đồng nếu khách hàng vi phạm nghiêm trọng các quy định sử dụng kho, sử dụng kho sai mục đích hoặc không thực hiện nghĩa vụ thanh toán theo thỏa thuận.',
          },
          {
            no: 6,
            text: 'Việc xử lý tài sản còn lại sau khi hợp đồng chấm dứt phải tuân thủ trình tự thông báo, thỏa thuận và quy định pháp luật. Đơn vị vận hành không được tự ý chiếm hữu hoặc xử lý tài sản của khách hàng.',
          },
        ],
      },
    ],
  },
  {
    no: 'VI',
    title: 'An ninh, an toàn và xử lý sự cố',
    articles: [
      {
        no: 16,
        title: 'Quy định về an ninh và hệ thống camera',
        clauses: [
          {
            no: 1,
            text: 'Đơn vị vận hành triển khai các biện pháp an ninh phù hợp nhằm đảm bảo an toàn cho cơ sở vật chất và khu vực lưu trữ.',
          },
          {
            no: 2,
            text: 'Hệ thống camera được sử dụng để giám sát các khu vực chung, lối đi, khu vực ra vào và những vị trí được phép lắp đặt.',
          },
          {
            no: 3,
            text: 'Dữ liệu camera được sử dụng để hỗ trợ xác minh các sự cố như mất mát, hư hỏng, xâm nhập trái phép hoặc vi phạm quy định kho.',
          },
          {
            no: 4,
            text: 'Khách hàng có quyền gửi yêu cầu kiểm tra camera khi có căn cứ hợp lý về sự cố liên quan đến tài sản của mình.',
          },
          {
            no: 5,
            text: 'Việc cung cấp hoặc trích xuất dữ liệu camera phải tuân thủ quy định về bảo mật thông tin, quyền riêng tư và các quy định pháp luật có liên quan.',
          },
          {
            no: 6,
            text: 'Đơn vị vận hành không cam kết hệ thống camera có thể ghi nhận mọi sự cố hoặc lưu trữ dữ liệu vô thời hạn. Thời gian lưu trữ phụ thuộc vào hệ thống và chính sách vận hành thực tế.',
          },
        ],
      },
      {
        no: 17,
        title: 'Xử lý sự cố và khiếu nại',
        clauses: [
          {
            no: 1,
            text: 'Khi phát hiện bất kỳ sự cố nào liên quan đến kho hoặc tài sản lưu trữ, khách hàng cần thông báo cho bộ phận hỗ trợ của đơn vị vận hành trong thời gian sớm nhất.',
          },
          {
            no: 2,
            text: 'Thông tin thông báo nên bao gồm:',
            bullets: [
              'Họ tên và thông tin liên hệ khách hàng.',
              'Mã hợp đồng hoặc mã lưu trữ.',
              'Vị trí kho hoặc mã hàng hóa liên quan.',
              'Thời điểm phát hiện sự cố.',
              'Mô tả tình trạng và thiệt hại.',
              'Hình ảnh hoặc tài liệu chứng minh (nếu có).',
            ],
          },
          {
            no: 3,
            text: 'Đơn vị vận hành có trách nhiệm tiếp nhận, kiểm tra và phản hồi khiếu nại trong thời gian hợp lý.',
          },
          {
            no: 4,
            text: 'Hai bên có trách nhiệm phối hợp cung cấp thông tin, tài liệu và bằng chứng liên quan nhằm xác minh nguyên nhân sự cố.',
          },
          {
            no: 5,
            text: 'Kết quả xử lý phải được ghi nhận bằng văn bản hoặc thông qua hệ thống quản lý để đảm bảo tính minh bạch.',
          },
          {
            no: 6,
            text: 'Nếu hai bên không thống nhất được phương án giải quyết, tranh chấp sẽ được xử lý thông qua thương lượng hoặc các phương thức giải quyết tranh chấp phù hợp theo quy định pháp luật.',
          },
        ],
      },
      {
        no: 18,
        title: 'Các trường hợp bất khả kháng',
        clauses: [
          {
            no: 1,
            text: 'Bất khả kháng là những sự kiện xảy ra khách quan, không thể lường trước và không thể khắc phục được mặc dù bên chịu ảnh hưởng đã áp dụng các biện pháp cần thiết trong khả năng cho phép.',
          },
          {
            no: 2,
            text: 'Các sự kiện có thể bao gồm thiên tai, bão lũ, động đất, hỏa hoạn do nguyên nhân khách quan, chiến tranh, dịch bệnh hoặc các sự kiện khác đáp ứng điều kiện bất khả kháng theo quy định pháp luật.',
          },
          {
            no: 3,
            text: 'Khi xảy ra sự kiện bất khả kháng, bên bị ảnh hưởng phải thông báo cho bên còn lại trong thời gian sớm nhất và cung cấp thông tin cần thiết về tình hình.',
          },
          {
            no: 4,
            text: 'Hai bên có trách nhiệm phối hợp thực hiện các biện pháp hợp lý nhằm hạn chế thiệt hại và đảm bảo an toàn cho con người, tài sản.',
          },
          {
            no: 5,
            text: 'Việc miễn trừ trách nhiệm chỉ được áp dụng trong phạm vi và điều kiện được pháp luật công nhận. Đơn vị vận hành không được mặc nhiên xem mọi sự cố tại kho là trường hợp bất khả kháng.',
          },
        ],
      },
    ],
  },
  {
    no: 'VII',
    title: 'Điều khoản thi hành',
    articles: [
      {
        no: 19,
        title: 'Hành vi vi phạm và biện pháp xử lý',
        clauses: [
          {
            no: 1,
            text: 'Các hành vi được xem là vi phạm quy định sử dụng kho bao gồm:',
            bullets: [
              'Cung cấp thông tin giả mạo hoặc không chính xác.',
              'Lưu trữ hàng hóa bị cấm hoặc không được phép tiếp nhận.',
              'Sử dụng kho sai mục đích.',
              'Tự ý cho thuê lại hoặc chuyển nhượng quyền sử dụng kho.',
              'Tự ý xâm nhập khu vực kho kệ.',
              'Cố ý gây hư hỏng cơ sở vật chất hoặc tài sản của khách hàng khác.',
              'Có hành vi gây mất an ninh, trật tự hoặc ảnh hưởng đến hoạt động chung của kho.',
              'Không thực hiện nghĩa vụ thanh toán theo hợp đồng.',
            ],
          },
          {
            no: 2,
            text: 'Tùy theo tính chất và mức độ vi phạm, đơn vị vận hành có thể áp dụng một hoặc nhiều biện pháp:',
            bullets: [
              'Nhắc nhở và yêu cầu khắc phục.',
              'Lập biên bản vi phạm.',
              'Yêu cầu bồi thường thiệt hại thực tế.',
              'Tạm dừng cung cấp một số dịch vụ theo hợp đồng.',
              'Chấm dứt hợp đồng theo điều kiện đã thỏa thuận.',
            ],
          },
          {
            no: 3,
            text: 'Việc xử lý vi phạm phải đảm bảo công bằng, minh bạch và tuân thủ quy định pháp luật.',
          },
        ],
      },
      {
        no: 20,
        title: 'Hiệu lực và cam kết thực hiện',
        clauses: [
          {
            no: 1,
            text: 'Quy định này có hiệu lực kể từ ngày được đơn vị vận hành công bố và áp dụng đối với các hợp đồng dịch vụ thuộc phạm vi điều chỉnh.',
          },
          {
            no: 2,
            text: 'Khách hàng có trách nhiệm đọc, hiểu và tuân thủ toàn bộ nội dung quy định trước khi xác nhận đăng ký sử dụng dịch vụ.',
          },
          {
            no: 3,
            text: 'Trong trường hợp có sự khác biệt giữa quy định chung và điều khoản cụ thể trong hợp đồng đã ký, các bên thực hiện theo thỏa thuận hợp đồng trong phạm vi phù hợp với pháp luật.',
          },
          {
            no: 4,
            text: 'Mọi vấn đề chưa được đề cập trong văn bản này sẽ được các bên trao đổi, thống nhất và giải quyết theo quy định pháp luật hiện hành.',
          },
        ],
      },
    ],
  },
];

export function WarehouseRulesScreen({ onBack }: Props) {
  return (
    <FlowScreen muted onBack={onBack} title="Quy định sử dụng kho" titleAlign="left">
      <ScrollView
        className="flex-1 bg-bg-muted"
        contentContainerStyle={{ padding: 16, paddingBottom: 36, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2 rounded-2xl bg-secondary-0 p-4">
          <View className="flex-row items-center gap-2">
            <Icon color={colors.semantic.textLink} name="menu-book" size={20} />
            <Text className="text-caption font-semibold text-text-link uppercase">
              Văn bản quy định
            </Text>
          </View>
          <Text className="text-title font-bold text-text-brand">
            Quy định sử dụng dịch vụ kho lưu trữ
          </Text>
          <Text className="text-body-sm text-text-secondary">
            Vui lòng đọc kỹ toàn bộ nội dung. Khi ký kết hợp đồng và sử dụng dịch vụ, bạn được xem
            là đã đọc, hiểu và đồng ý tuân thủ các quy định này.
          </Text>
        </View>

        {CHAPTERS.map((chapter) => (
          <View className="gap-3" key={chapter.no}>
            <View className="rounded-xl bg-secondary-50 px-4 py-3">
              <Text className="text-caption font-semibold text-text-link uppercase">
                {`Chương ${chapter.no}`}
              </Text>
              <Text className="text-body font-bold text-text-brand uppercase">{chapter.title}</Text>
            </View>
            {chapter.articles.map((article) => (
              <ArticleBlock article={article} key={article.no} />
            ))}
          </View>
        ))}
      </ScrollView>
    </FlowScreen>
  );
}

function ArticleBlock({ article }: { article: Article }) {
  return (
    <View className="gap-3 rounded-2xl bg-bg-card p-4">
      <Text className="text-subtitle font-bold text-text-primary">
        {`Điều ${article.no}. ${article.title}`}
      </Text>
      {article.intro ? (
        <Text className="text-body-sm text-text-secondary">{article.intro}</Text>
      ) : null}
      <View className="gap-3">
        {article.clauses.map((clause, index) => (
          <ClauseBlock clause={clause} key={`${article.no}-${index}`} />
        ))}
      </View>
    </View>
  );
}

function ClauseBlock({ clause }: { clause: Clause }) {
  if (clause.label) {
    return (
      <View className="gap-2">
        <Text className="text-body font-semibold text-text-primary">{clause.label}</Text>
        {clause.bullets ? <BulletList items={clause.bullets} /> : null}
      </View>
    );
  }

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        {clause.no != null ? (
          <Text className="text-body font-semibold text-text-primary">{`${clause.no}.`}</Text>
        ) : null}
        <Text className="flex-1 text-body-sm text-text-secondary">{clause.text}</Text>
      </View>
      {clause.bullets ? <BulletList items={clause.bullets} /> : null}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View className="gap-2 pl-1.5">
      {items.map((item) => (
        <View className="flex-row gap-2.5" key={item}>
          <View className="mt-1.5 size-1.5 rounded-full bg-action-primary" />
          <Text className="flex-1 text-body-sm text-text-secondary">{item}</Text>
        </View>
      ))}
    </View>
  );
}
