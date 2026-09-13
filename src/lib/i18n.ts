import type { ApiErrorCode } from "./api";
import type { ChangeAction, Lang, Role } from "./types";

/** Arguments prepared by describeChange() for change-feed sentences */
interface ChangeArgs {
  actor: string;
  date: string;
  time: string;
  oldTime?: string;
  trainerName: string;
  note?: string;
  range: string;
  count: number;
}

/** RU numeral agreement: 1 смена / 3 смены / 14 смен */
function ruShifts(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} смена`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} смены`;
  return `${n} смен`;
}

/** RU numeral agreement: 1 тренер / 2 тренера / 5 тренеров */
function ruTrainers(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} тренер`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} тренера`;
  return `${n} тренеров`;
}

export interface Dict {
  subtitle: string;
  views: { day: string; three: string; week: string; month: string };
  today: string;
  addShift: string;
  editShift: string;
  invite: string;
  inviteTitle: string;
  inviteDesc: string;
  inviteWa: string;
  copy: string;
  copied: string;
  activity: string;
  activityEmpty: string;
  loggedInAs: string;
  you: string;
  theme: string;
  themeAuto: string;
  lightGroup: string;
  darkGroup: string;
  fontSize: { label: string; inc: string; dec: string; reset: string };
  roles: Record<Role, string>;
  connection: { online: string; offline: string };
  switchLang: string;
  templateTrigger: string;
  template: {
    title: string;
    desc: string;
    readonlyHint: string;
    save: string;
    apply: string;
    applyTitle: string;
    applyWeek: string;
    applyWarn: (range: string) => string;
    applyConfirm: string;
    cancel: string;
    saved: string;
    applied: (n: number) => string;
    empty: string;
    add: string;
    quick: string;
    count: (n: number) => string;
  };
  userMenu: { profile: string; install: string; logout: string };
  trainersDialog: {
    title: string;
    count: (n: number) => string;
    phone: string;
    noPhone: string;
    call: string;
    write: string;
    add: string;
    addTitle: string;
    addDesc: string;
    create: string;
    created: (name: string) => string;
    generate: string;
    pinHint: string;
    deleteTitle: string;
    deleteWarn: (name: string, shifts: number, slots: number, personal: number) => string;
    deleteConfirm: string;
    deleted: (name: string) => string;
  };
  profile: {
    title: string;
    desc: string;
    phone: string;
    phoneHint: string;
    newPin: string;
    newPinHint: string;
    save: string;
    saved: string;
  };
  whatsapp: {
    share: string;
    otherChat: string;
    copyMsg: string;
    copiedMsg: string;
    noPhone: string;
  };
  auth: {
    tagline: string;
    tabLogin: string;
    tabRegister: string;
    name: string;
    namePh: string;
    pickName: string;
    pin: string;
    pinPh: string;
    pinConfirm: string;
    pinConfirmPh: string;
    phone: string;
    phoneOptional: string;
    phoneHint: string;
    phonePh: string;
    loginBtn: string;
    registerBtn: string;
    demoHint: string;
    registerNote: string;
    welcome: (name: string) => string;
    errName: string;
    errPin: string;
    errPinMatch: string;
    errPhone: string;
  };
  errors: Record<ApiErrorCode, string>;
  changes: {
    badges: Record<ChangeAction, string>;
    shiftAdd: (a: ChangeArgs) => string;
    shiftEdit: (a: ChangeArgs) => string;
    shiftDelete: (a: ChangeArgs) => string;
    templateSave: (a: ChangeArgs) => string;
    templateApply: (a: ChangeArgs) => string;
    trainerJoin: (a: ChangeArgs) => string;
    trainerAdd: (a: ChangeArgs) => string;
    trainerRemove: (a: ChangeArgs) => string;
  };
  fields: { trainer: string; date: string; start: string; end: string; note: string; notePh: string; windowHint: string };
  personal: {
    /** «+» button in personal mode — creates a private event */
    add: string;
    /** full name of the private calendar (toggle + title badge) */
    calendar: string;
    /** short label for narrow screens */
    calendarShort: string;
    /** label of the toggle that returns to the shared shifts calendar */
    team: string;
    teamShort: string;
    empty: string;
    emptyHint: string;
    addTitle: string;
    editTitle: string;
    titleLabel: string;
    titlePh: string;
    allDay: string;
    privateHint: string;
    added: string;
    updated: string;
    deleted: string;
    /** hint above the empty personal grid — teaches the Google-style drag-to-create */
    dragHint: string;
    /** header of the quick-create popup that opens after the drag */
    quickTitle: string;
    /** button that opens the full dialog from the quick-create popup */
    moreOptions: string;
    /** Google-like event color (label + "default" swatch name) */
    color: string;
    colorDefault: string;
    /** recurrence (Google-style subset) */
    repeat: string;
    repeatNone: string;
    repeatDaily: string;
    repeatWeekly: string;
    repeatMonthly: string;
    /** hint shown while editing a recurring series */
    seriesHint: string;
    /** delete-scope chooser (this occurrence vs the whole series) */
    delScopeTitle: string;
    delScopeDesc: string;
    delThisOnly: string;
    delAllEvents: string;
  };
  btn: { save: string; cancel: string; edit: string; delete: string; close: string };
  toasts: { added: string; updated: string; deleted: string; loadError: string };
  footerTag: string;
  footerAutosave: string;
  more: (n: number) => string;
  justNow: string;
  loading: string;
  retry: string;
  errorTitle: string;
}

export const dict: Record<Lang, Dict> = {
  ru: {
    subtitle: "смены тренеров",
    views: { day: "Сегодня", three: "3 дня", week: "Неделя", month: "Месяц" },
    today: "Сегодня",
    addShift: "Добавить смену",
    editShift: "Изменить смену",
    invite: "Пригласить",
    inviteTitle: "Пригласить тренера",
    inviteDesc:
      "Отправьте ссылку тренеру — он зарегистрируется в один клик и сразу увидит календарь.",
    inviteWa: "Присоединяйтесь к GymShift — онлайн-календарь смен тренеров:",
    copy: "Копировать",
    copied: "Ссылка скопирована",
    activity: "Последние изменения",
    activityEmpty: "Пока изменений нет — всё спокойно",
    loggedInAs: "Вы вошли как",
    you: "вы",
    theme: "Тема",
    themeAuto: "Авто — по времени суток",
    lightGroup: "Светлые",
    darkGroup: "Тёмные",
    fontSize: { label: "Размер шрифта", inc: "Крупнее", dec: "Мельче", reset: "Сбросить" },
    roles: { admin: "Старший админ", trainer: "Тренер" },
    connection: { online: "онлайн", offline: "офлайн" },
    switchLang: "Переключить на иврит",
    templateTrigger: "Стандартные смены",
    template: {
      title: "Стандартные смены",
      desc: "Еженедельный шаблон. Применение к неделе заменяет её смены стандартными.",
      readonlyHint: "Просмотр — шаблон изменяет старший админ",
      save: "Сохранить шаблон",
      apply: "Применить к неделе…",
      applyTitle: "Применить шаблон к неделе",
      applyWeek: "Неделя",
      applyWarn: (range) =>
        `Смены недели ${range} будут заменены стандартными. Это действие нельзя отменить.`,
      applyConfirm: "Заменить смены",
      cancel: "Отмена",
      saved: "Шаблон сохранён",
      applied: (n) => `Неделя заменена стандартными сменами (${ruShifts(n)})`,
      empty: "Смен нет",
      add: "Добавить",
      quick: "Стандартные смены дня:",
      count: (n) => `${ruShifts(n)} в неделю`,
    },
    userMenu: { profile: "Мой профиль", install: "Установить приложение", logout: "Выйти" },
    trainersDialog: {
      title: "Все тренера",
      count: (n) => `${ruTrainers(n)} в системе`,
      phone: "Телефон",
      noPhone: "Телефон не указан",
      call: "Позвонить",
      write: "Написать в WhatsApp",
      add: "Добавить тренера",
      addTitle: "Новый тренер",
      addDesc: "Тренер войдёт в календарь по имени и PIN — без регистрации",
      create: "Добавить",
      created: (name) => `Тренер ${name} добавлен`,
      generate: "Сгенерировать PIN",
      pinHint: "4–8 цифр — передайте тренеру",
      deleteTitle: "Удалить тренера?",
      deleteWarn: (name, shifts, slots, personal) =>
        `${name} будет удалён из системы. Вместе с ним исчезнут его смены: ${ruShifts(shifts)} в расписании и ${ruShifts(slots)} в стандартных сменах${personal > 0 ? `, а также ${personal} в личном календаре` : ""}. Это действие нельзя отменить.`,
      deleteConfirm: "Удалить",
      deleted: (name) => `Тренер ${name} удалён`,
    },
    profile: {
      title: "Мой профиль",
      desc: "Телефон нужен для получения смен в WhatsApp. PIN можно поменять.",
      phone: "Телефон",
      phoneHint: "для WhatsApp-уведомлений",
      newPin: "Новый PIN",
      newPinHint: "4–8 цифр, оставьте пустым, чтобы не менять",
      save: "Сохранить",
      saved: "Профиль обновлён",
    },
    whatsapp: {
      share: "Отправить в WhatsApp",
      otherChat: "Другой чат…",
      copyMsg: "Копировать текст",
      copiedMsg: "Текст скопирован",
      noPhone: "Ни у кого нет телефона — отправьте в другой чат",
    },
    auth: {
      tagline: "смены тренеров — онлайн",
      tabLogin: "Вход",
      tabRegister: "Регистрация",
      name: "Имя",
      namePh: "Например, Игорь",
      pickName: "Выберите своё имя:",
      pin: "PIN-код",
      pinPh: "4–8 цифр",
      pinConfirm: "Повторите PIN",
      pinConfirmPh: "ещё раз тот же PIN",
      phone: "Телефон",
      phoneOptional: "необязательно",
      phoneHint: "нужен, чтобы получать смены в WhatsApp",
      phonePh: "+972 50-1234567",
      loginBtn: "Войти",
      registerBtn: "Зарегистрироваться",
      demoHint: "Демо-доступ: PIN 1234",
      registerNote: "Первый зарегистрированный аккаунт станет старшим админом",
      welcome: (name) => `Добро пожаловать, ${name}!`,
      errName: "Введите имя (минимум 2 символа)",
      errPin: "PIN — от 4 до 8 цифр",
      errPinMatch: "PIN-коды не совпадают",
      errPhone: "Проверьте номер телефона",
    },
    errors: {
      bad_request: "Некорректный запрос — проверьте поля",
      name_taken: "Это имя уже занято",
      invalid: "Неверное имя или PIN",
      forbidden: "Недостаточно прав для этого действия",
      not_found: "Не найдено — возможно, уже удалено",
      window: "Время вне рабочего окна этого дня",
      overlap: "У тренера уже есть пересекающаяся смена",
      unauthorized: "Сессия истекла — войдите снова",
      network: "Нет связи с сервером — проверьте интернет",
    },
    changes: {
      badges: {
        shift_add: "новая смена",
        shift_edit: "изменение",
        shift_delete: "удаление",
        template_save: "шаблон",
        template_apply: "шаблон → неделя",
        trainer_join: "новый тренер",
        trainer_add: "тренер добавлен",
        trainer_remove: "тренер удалён",
      },
      shiftAdd: (a) =>
        `${a.actor} добавил смену — ${a.date} · ${a.time} (${a.trainerName})${a.note ? ` · ${a.note}` : ""}`,
      shiftEdit: (a) =>
        `${a.actor} изменил смену — ${a.date} · ${a.time} (${a.trainerName})${a.oldTime ? ` · было ${a.oldTime}` : ""}${a.note ? ` · ${a.note}` : ""}`,
      shiftDelete: (a) => `${a.actor} удалил смену — ${a.date} · ${a.time} (${a.trainerName})`,
      templateSave: (a) => `${a.actor} сохранил стандартные смены (${ruShifts(a.count)})`,
      templateApply: (a) =>
        `${a.actor} применил стандартные смены на неделю ${a.range} (${ruShifts(a.count)})`,
      trainerJoin: (a) => `${a.actor} присоединился к календарю`,
      trainerAdd: (a) => `${a.actor} добавил тренера ${a.trainerName}`,
      trainerRemove: (a) => `${a.actor} удалил тренера ${a.trainerName}`,
    },
    fields: {
      trainer: "Тренер",
      date: "Дата",
      start: "Начало",
      end: "Конец",
      note: "Заметка",
      notePh: "необязательно, например «зал №2»",
      windowHint: "рабочее окно",
    },
    personal: {
      add: "Добавить личное",
      calendar: "Личный календарь",
      calendarShort: "Личный",
      team: "Общий календарь",
      teamShort: "Общий",
      empty: "В этом периоде нет личных событий",
      emptyHint: "Создайте первое — его будете видеть только вы",
      addTitle: "Личное событие",
      editTitle: "Изменить личное событие",
      titleLabel: "Название",
      titlePh: "Например: встреча, отпуск, напоминание",
      allDay: "Весь день",
      privateHint: "Видно только вам — другие тренера этого не видят",
      added: "Личное событие добавлено",
      updated: "Личное событие обновлено",
      deleted: "Личное событие удалено",
      dragHint: "Совет: протяните мышью по сетке или зажмите палец — так создаётся личное событие, как в Google Календаре",
      quickTitle: "Новое личное событие",
      moreOptions: "Подробнее…",
      color: "Цвет",
      colorDefault: "Обычный",
      repeat: "Повтор",
      repeatNone: "Не повторять",
      repeatDaily: "Ежедневно",
      repeatWeekly: "Еженедельно",
      repeatMonthly: "Ежемесячно",
      seriesHint: "Правки применяются ко всей серии; смена даты перенесёт только это событие",
      delScopeTitle: "Удалить повторяющееся событие?",
      delScopeDesc: "Это событие входит в серию повторов. Что удалить?",
      delThisOnly: "Только это событие",
      delAllEvents: "Все события серии",
    },
    btn: { save: "Сохранить", cancel: "Отмена", edit: "Изменить", delete: "Удалить", close: "Закрыть" },
    toasts: {
      added: "Смена добавлена",
      updated: "Смена обновлена",
      deleted: "Смена удалена",
      loadError: "Не удалось загрузить данные",
    },
    footerTag: "онлайн-календарь смен для тренеров",
    footerAutosave: "данные сохраняются автоматически",
    more: (n) => `ещё ${n}`,
    justNow: "только что",
    loading: "Загружаем календарь…",
    retry: "Повторить",
    errorTitle: "Что-то не загрузилось",
  },
  he: {
    subtitle: "משמרות מאמנים",
    views: { day: "היום", three: "3 ימים", week: "שבוע", month: "חודש" },
    today: "היום",
    addShift: "הוספת משמרת",
    editShift: "עריכת משמרת",
    invite: "הזמנה",
    inviteTitle: "הזמנת מאמן",
    inviteDesc: "שלחו קישור למאמן — הוא נרשם בלחיצה אחת ומיד רואה את לוח השנה.",
    inviteWa: "הצטרפו אל GymShift — לוח שנה מקוון למשמרות מאמנים:",
    copy: "העתקה",
    copied: "הקישור הועתק",
    activity: "שינויים אחרונים",
    activityEmpty: "אין עדיין שינויים — הכול רגוע",
    loggedInAs: "מחוברים בתור",
    you: "אתם",
    theme: "ערכת נושא",
    themeAuto: "אוטומטי — לפי שעת היום",
    lightGroup: "בהירות",
    darkGroup: "כהות",
    fontSize: { label: "גודל הטקסט", inc: "גדול יותר", dec: "קטן יותר", reset: "איפוס" },
    roles: { admin: "מנהל ראשי", trainer: "מאמן" },
    connection: { online: "מחובר", offline: "מנותק" },
    switchLang: "עבור לרוסית",
    templateTrigger: "משמרות סטנדרטיות",
    template: {
      title: "משמרות סטנדרטיות",
      desc: "תבנית שבועית. החלה על שבוע מחליפה את המשמרות שלו במשמרות הסטנדרטיות.",
      readonlyHint: "צפייה בלבד — רק המנהל הראשי עורך את התבנית",
      save: "שמירת התבנית",
      apply: "החלה על שבוע…",
      applyTitle: "החלת התבנית על שבוע",
      applyWeek: "שבוע",
      applyWarn: (range) =>
        `המשמרות של השבוע ${range} יוחלפו במשמרות הסטנדרטיות. לא ניתן לבטל את הפעולה.`,
      applyConfirm: "החלפת המשמרות",
      cancel: "ביטול",
      saved: "התבנית נשמרה",
      applied: (n) => `השבוע הוחלף במשמרות הסטנדרטיות (${n} משמרות)`,
      empty: "אין משמרות",
      add: "הוספה",
      quick: "משמרות סטנדרטיות ליום:",
      count: (n) => `${n} משמרות בשבוע`,
    },
    userMenu: { profile: "הפרופיל שלי", install: "התקנת האפליקציה", logout: "התנתקות" },
    trainersDialog: {
      title: "כל המאמנים",
      count: (n) => `${n} מאמנים במערכת`,
      phone: "טלפון",
      noPhone: "הטלפון לא צוין",
      call: "שיחת טלפון",
      write: "שליחת הודעת WhatsApp",
      add: "הוספת מאמן",
      addTitle: "מאמן חדש",
      addDesc: "המאמן ייכנס ליומן עם שם וקוד PIN — בלי הרשמה",
      create: "הוספה",
      created: (name) => `המאמן ${name} נוסף`,
      generate: "יצירת קוד PIN אוטומטית",
      pinHint: "4–8 ספרות — מסרו למאמן",
      deleteTitle: "להסיר את המאמן?",
      deleteWarn: (name, shifts, slots, personal) =>
        `${name} יוסר מהמערכת. יחד איתו יימחקו המשמרות שלו: ${shifts === 1 ? "משמרה אחת" : `${shifts} משמרות`} בלוח ועוד ${slots === 1 ? "משמרה אחת" : `${slots} משמרות`} במשמרות הסטנדרטיות${personal > 0 ? `, וכן ${personal === 1 ? "אירוע אישי אחד" : `${personal} אירועים אישיים`} ביומן האישי` : ""}. לא ניתן לבטל את הפעולה.`,
      deleteConfirm: "הסרה",
      deleted: (name) => `המאמן ${name} הוסר`,
    },
    profile: {
      title: "הפרופיל שלי",
      desc: "מספר הטלפון משמש לקבלת משמרות ב-WhatsApp. אפשר לשנות גם את הקוד.",
      phone: "טלפון",
      phoneHint: "להתראות WhatsApp",
      newPin: "קוד חדש",
      newPinHint: "4–8 ספרות, השאירו ריק כדי לא לשנות",
      save: "שמירה",
      saved: "הפרופיל עודכן",
    },
    whatsapp: {
      share: "שליחה ב-WhatsApp",
      otherChat: "צ׳אט אחר…",
      copyMsg: "העתקת הטקסט",
      copiedMsg: "הטקסט הועתק",
      noPhone: "אין מספרי טלפון — שלחו לצ׳אט אחר",
    },
    auth: {
      tagline: "משמרות מאמנים — אונליין",
      tabLogin: "כניסה",
      tabRegister: "הרשמה",
      name: "שם",
      namePh: "לדוגמה, יוסי",
      pickName: "בחרו את השם שלכם:",
      pin: "קוד PIN",
      pinPh: "4–8 ספרות",
      pinConfirm: "אימות PIN",
      pinConfirmPh: "אותו קוד שוב",
      phone: "טלפון",
      phoneOptional: "לא חובה",
      phoneHint: "נחוץ כדי לקבל משמרות ב-WhatsApp",
      phonePh: "050-1234567",
      loginBtn: "כניסה",
      registerBtn: "הרשמה",
      demoHint: "גישת דמו: קוד PIN 1234",
      registerNote: "החשבון הראשון שיירשם יהפוך למנהל הראשי",
      welcome: (name) => `ברוך הבא, ${name}!`,
      errName: "הזינו שם (לפחות 2 תווים)",
      errPin: "הקוד — 4 עד 8 ספרות",
      errPinMatch: "הקודים אינם תואמים",
      errPhone: "בדקו את מספר הטלפון",
    },
    errors: {
      bad_request: "בקשה שגויה — בדקו את השדות",
      name_taken: "השם הזה כבר תפוס",
      invalid: "שם או קוד שגויים",
      forbidden: "אין הרשאה לפעולה זו",
      not_found: "לא נמצא — ייתכן שנמחק כבר",
      window: "השעות מחוץ לחלון העבודה של היום הזה",
      overlap: "למאמן הזה כבר יש משמרת שחופפת",
      unauthorized: "החיבור פג — יש להיכנס שוב",
      network: "אין תקשורת עם השרת — בדקו את האינטרנט",
    },
    changes: {
      badges: {
        shift_add: "משמרת חדשה",
        shift_edit: "עריכה",
        shift_delete: "מחיקה",
        template_save: "תבנית",
        template_apply: "תבנית → שבוע",
        trainer_join: "מאמן חדש",
        trainer_add: "מאמן נוסף",
        trainer_remove: "מאמן הוסר",
      },
      shiftAdd: (a) =>
        `${a.actor} הוסיף משמרת — ${a.date} · ${a.time} (${a.trainerName})${a.note ? ` · ${a.note}` : ""}`,
      shiftEdit: (a) =>
        `${a.actor} ערך משמרת — ${a.date} · ${a.time} (${a.trainerName})${a.oldTime ? ` · הייתה ${a.oldTime}` : ""}${a.note ? ` · ${a.note}` : ""}`,
      shiftDelete: (a) => `${a.actor} מחק משמרת — ${a.date} · ${a.time} (${a.trainerName})`,
      templateSave: (a) => `${a.actor} שמר את המשמרות הסטנדרטיות (${a.count} משמרות)`,
      templateApply: (a) =>
        `${a.actor} החיל את המשמרות הסטנדרטיות על השבוע ${a.range} (${a.count} משמרות)`,
      trainerJoin: (a) => `${a.actor} הצטרף ליומן`,
      trainerAdd: (a) => `${a.actor} הוסיף את ${a.trainerName} כמאמן`,
      trainerRemove: (a) => `${a.actor} הסיר את ${a.trainerName}`,
    },
    fields: {
      trainer: "מאמן",
      date: "תאריך",
      start: "התחלה",
      end: "סיום",
      note: "הערה",
      notePh: "לא חובה, לדוגמה «אולם 2»",
      windowHint: "חלון עבודה",
    },
    personal: {
      add: "הוספת אירוע אישי",
      calendar: "יומן אישי",
      calendarShort: "אישי",
      team: "לוח המשמרות",
      teamShort: "משותף",
      empty: "אין אירועים אישיים בתקופה זו",
      emptyHint: "צרו את הראשון — רק אתם תראו אותו",
      addTitle: "אירוע אישי",
      editTitle: "עריכת אירוע אישי",
      titleLabel: "שם האירוע",
      titlePh: "למשל: פגישה, חופשה, תזכורת",
      allDay: "כל היום",
      privateHint: "גלוי רק לכם — מאמנים אחרים לא רואים זאת",
      added: "האירוע האישי נוסף",
      updated: "האירוע האישי עודכן",
      deleted: "האירוע האישי נמחק",
      dragHint: "טיפ: גררו בעכבר בטבלה או החזיקו אצבע — כך נוצר אירוע אישי, כמו ב-Google Calendar",
      quickTitle: "אירוע אישי חדש",
      moreOptions: "אפשרויות נוספות…",
      color: "צבע",
      colorDefault: "רגיל",
      repeat: "חזרה",
      repeatNone: "לא חוזר",
      repeatDaily: "מדי יום",
      repeatWeekly: "מדי שבוע",
      repeatMonthly: "מדי חודש",
      seriesHint: "השינויים יחולו על כל הסדרה; שינוי תאריך יעביר רק אירוע זה",
      delScopeTitle: "למחוק אירוע חוזר?",
      delScopeDesc: "אירוע זה חלק מסדרה חוזרת. מה למחוק?",
      delThisOnly: "רק אירוע זה",
      delAllEvents: "את כל הסדרה",
    },
    btn: { save: "שמירה", cancel: "ביטול", edit: "עריכה", delete: "מחיקה", close: "סגירה" },
    toasts: {
      added: "המשמרת נוספה",
      updated: "המשמרת עודכנה",
      deleted: "המשמרת נמחקה",
      loadError: "טעינת הנתונים נכשלה",
    },
    footerTag: "לוח שנה מקוון למשמרות מאמנים",
    footerAutosave: "הנתונים נשמרים אוטומטית",
    more: (n) => `עוד ${n}`,
    justNow: "עכשיו",
    loading: "טוען את לוח השנה…",
    retry: "נסה שוב",
    errorTitle: "משהו לא נטען",
  },
};

export const LANGS: Lang[] = ["ru", "he"];
