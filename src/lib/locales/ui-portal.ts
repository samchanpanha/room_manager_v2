import type { PhraseTable } from "./phrase-table";

/// §M25 Resident Portal (+ /portal/login and the pay panel). The portal shell is
/// mobile-first with its own tab bar, so its chrome is authored separately from
/// the back-office dictionaries: bottom-tab labels, resident-facing wording,
/// request presets and the OTP sign-in flow.
export const uiPortal: PhraseTable = {
  km: {
    // shell — bottom tab bar + header brand
    "Home": "ទំព័រដើម",
    "Rent": "ថ្លៃជួល",
    "Requests": "សំណើ",
    "Docs": "ឯកសារ",
    "Me": "ខ្ញុំ",
    "Resident": "អ្នកស្នាក់នៅ",
    "Resident Portal": "ខ្លោងទ្វារអ្នកស្នាក់នៅ",
    "My profile": "ប្រវត្តិរូបរបស់ខ្ញុំ",
    "Rent & invoices": "ថ្លៃជួល និងវិក្កយបត្រ",
    "Your tenancy is active": "ការជួលរបស់អ្នកកំពុងដំណើរការ",
    "No rent invoice is due right now.": "មិនមានវិក្កយបត្រថ្លៃជួលដែលត្រូវបង់ទេឥឡូវនេះ។",
    "Pay now →": "បង់ប្រាក់ឥឡូវ →",
    "View invoices →": "មើលវិក្កយបត្រ →",
    "Subtotal": "សរុបរង",
    "Tax": "ពន្ធ",

    // OTP sign-in
    "Resident sign-in": "ការចូលរបស់អ្នកស្នាក់នៅ",
    "Sign in": "ចូលគណនី",
    "Send code": "ផ្ញើកូដ",
    "Enter the email or phone number you registered with.": "បញ្ចូលអ៊ីមែល ឬលេខទូរស័ព្ទដែលអ្នកបានចុះឈ្មោះ។",
    "Could not send the code": "មិនអាចផ្ញើកូដបានទេ",
    "Could not verify the code": "មិនអាចផ្ទៀងផ្ទាត់កូដបានទេ",
    "Checking…": "កំពុងពិនិត្យ…",
    "Sending…": "កំពុងផ្ញើ…",
    "Preparing…": "កំពុងរៀបចំ…",
    "Uploading…": "កំពុងបង្ហោះ…",

    // requests (maintenance · complaints · room move · move-out)
    "Complaint filed": "បានដាក់ពាក្យបណ្តឹង",
    "Ticket raised": "បានបង្កើតសំណើ",
    "Room move": "ការផ្លាស់ទីបន្ទប់",
    "No tickets yet.": "មិនទាន់មានសំណើទេ។",
    "No vacant rooms right now.": "មិនមានបន្ទប់ទំនេរទេឥឡូវនេះ។",
    "Kitchen tap leaking": "ក្បាលទឹកផ្ទះបាយលេច",
    "Loud music after midnight": "សំឡេងតន្ត្រីខ្លាំងក្រោយពាក់កណ្តាលអធ្រាត្រ",
    "Quieter room preferred": "ចង់បានបន្ទប់ស្ងាត់ជាង",
    "Since yesterday evening, under the sink…": "ចាប់ពីល្ងាចម្សិលមិញ ក្រោមអាងលាង…",

    // move-out notice
    "Notice given — reception will confirm your move-out": "បានជូនដំណឹង — ផ្នែកទទួលភ្ញៀវនឹងបញ្ជាក់ការចេញរបស់អ្នក",

    // request categories (maintenance ticket M19 / complaint M22 option labels)
    "plumbing": "ប្រព័ន្ធទឹក",
    "electrical": "ប្រព័ន្ធអគ្គិសនី",
    "appliance": "គ្រឿងបរិក្ខារ",
    "furniture": "គ្រឿងសង្ហារិម",
    "internet": "អ៊ីនធឺណិត",
    "noise": "សំឡេងរំខាន",
    "cleanliness": "អនាម័យ",
    "neighbor": "អ្នកជិតខាង",
    "facility": "កន្លែងប្រើប្រាស់រួម",
    "billing": "វិក្កយបត្រ",
    "Room-move requested — staff will review": "បានស្នើផ្លាស់បន្ទប់ — បុគ្គលិកនឹងពិនិត្យ",
    "Your lease is already in notice ({status}).": "កិច្ចសន្យារបស់អ្នកស្ថិតក្នុងស្ថានភាពជូនដំណឹងរួចហើយ ({status})។",

    // pay panel
    "Payment failed — try again.": "ការទូទាត់បរាជ័យ — សូមព្យាយាមម្តងទៀត។",
    "Waiting for the payment gateway…": "កំពុងរង់ចាំច្រកទូទាត់…",
    "Pay {amount} by QR": "បង់ {amount} តាម QR",
    "scan with your banking app": "ស្កេនដោយកម្មវិធីធនាគាររបស់អ្នក",
    "Payment QR {code}": "QR ទូទាត់ {code}",

    // OTP sign-in copy
    "We sent a 6-digit code to {identifier}.": "យើងបានផ្ញើកូដ ៦ ខ្ទង់ទៅ {identifier}។",
    "Demo mode — your code is": "របៀបសាកល្បង — កូដរបស់អ្នកគឺ",
    "Use a different email or phone": "ប្រើអ៊ីមែល ឬលេខទូរស័ព្ទផ្សេង",
    "We could not find a resident with that email or phone. Please check with reception.":
      "យើងរកមិនឃើញអ្នកស្នាក់នៅដែលមានអ៊ីមែល ឬលេខទូរស័ព្ទនេះទេ។ សូមពិនិត្យជាមួយផ្នែកទទួលភ្ញៀវ។"
  },
  zh: {
    // shell — bottom tab bar + header brand
    "Home": "首页",
    "Rent": "租金",
    "Requests": "请求",
    "Docs": "文件",
    "Me": "我的",
    "Resident": "住户",
    "Resident Portal": "住户门户",
    "My profile": "我的资料",
    "Rent & invoices": "租金与账单",
    "Your tenancy is active": "您的租约有效",
    "No rent invoice is due right now.": "目前没有到期的租金账单。",
    "Pay now →": "立即支付 →",
    "View invoices →": "查看账单 →",
    "Subtotal": "小计",
    "Tax": "税",

    // OTP sign-in
    "Resident sign-in": "住户登录",
    "Sign in": "登录",
    "Send code": "发送验证码",
    "Enter the email or phone number you registered with.": "请输入您注册时使用的邮箱或手机号。",
    "Could not send the code": "无法发送验证码",
    "Could not verify the code": "无法验证验证码",
    "Checking…": "正在检查…",
    "Sending…": "正在发送…",
    "Preparing…": "正在准备…",
    "Uploading…": "正在上传…",

    // requests (maintenance · complaints · room move · move-out)
    "Complaint filed": "投诉已提交",
    "Ticket raised": "工单已创建",
    "Room move": "换房",
    "No tickets yet.": "暂无工单。",
    "No vacant rooms right now.": "目前没有空房。",
    "Kitchen tap leaking": "厨房水龙头漏水",
    "Loud music after midnight": "午夜后音乐过响",
    "Quieter room preferred": "希望更安静的房间",
    "Since yesterday evening, under the sink…": "从昨晚开始，水槽下方……",

    // move-out notice
    "Notice given — reception will confirm your move-out": "已提交通知 — 前台将确认您的退房",

    // request categories (maintenance ticket M19 / complaint M22 option labels)
    "plumbing": "水管",
    "electrical": "电路",
    "appliance": "家电",
    "furniture": "家具",
    "internet": "网络",
    "noise": "噪音",
    "cleanliness": "卫生",
    "neighbor": "邻居",
    "facility": "公共设施",
    "billing": "账务",
    "Room-move requested — staff will review": "换房申请已提交 — 员工将审核",
    "Your lease is already in notice ({status}).": "您的租约已处于通知状态（{status}）。",

    // pay panel
    "Payment failed — try again.": "支付失败 — 请重试。",
    "Waiting for the payment gateway…": "正在等待支付网关…",
    "Pay {amount} by QR": "通过二维码支付 {amount}",
    "scan with your banking app": "使用您的银行应用扫描",
    "Payment QR {code}": "支付二维码 {code}",

    // OTP sign-in copy
    "We sent a 6-digit code to {identifier}.": "我们已向 {identifier} 发送 6 位验证码。",
    "Demo mode — your code is": "演示模式 — 您的验证码是",
    "Use a different email or phone": "使用其他邮箱或手机号",
    "We could not find a resident with that email or phone. Please check with reception.":
      "未找到使用该邮箱或手机号的住户，请向前台核实。"
  }
};
