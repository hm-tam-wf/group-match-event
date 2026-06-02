const SHEET_NAME      = "NguoiChoi";
const FIELD_KEYS      = ["name", "email", "phone"];
const FIELD_LABELS    = ["Tên",  "Email", "SĐT"];
const BLOCK_DUP_EMAIL = true;
const CAPACITY        = 10;   // sĩ số tối đa mỗi đội (1 icon = 1 đội). Phải khớp CAPACITY ở ClientConfig.html

// Cột (1-based): 1=Thời gian, 2=Biểu tượng, 3..=field, cuối=PlayerID
const ICON_COL        = 2;
const FIRST_FIELD_COL = 3;
const NAME_COL        = FIRST_FIELD_COL + FIELD_KEYS.indexOf("name");
const EMAIL_COL       = FIRST_FIELD_COL + FIELD_KEYS.indexOf("email");
const PID_COL         = FIRST_FIELD_COL + FIELD_KEYS.length;
const TOTAL_COL       = PID_COL;
