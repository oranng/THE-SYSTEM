# THE SYSTEM

> *"You have acquired the qualifications to be a Player."*

A **star-themed self-improvement RPG** for Android. THE SYSTEM turns your real-life
habits into an RPG progression loop — a single-player, fully offline app. All data
lives in a local SQLite database on the device. No account, no server, no cloud.

<p align="center">
  <img src="docs/screenshots/command.png" width="18%" alt="Command — daily objectives" />
  <img src="docs/screenshots/ascend.png" width="18%" alt="Ascend — ascension path" />
  <img src="docs/screenshots/mirror.png" width="18%" alt="Mirror — character sheet" />
  <img src="docs/screenshots/codex.png" width="18%" alt="Codex — mission list" />
  <img src="docs/screenshots/archive.png" width="18%" alt="Archive — mission history" />
</p>

---

## СИСТЕМА — русская версия

Эта копия переведена на русский и настроена под личные цели игрока.

- **14 ежедневных испытаний**: подъём до 08:00, отбой до 23:30, чистое питание,
  Протокол Тишины, тренировка, 1 час ИИ и кода, лимит соцсетей, порядок дома,
  движок ACE, учёт денег в гривнах, рост дохода до $1000+, время с Дианой,
  прогулка и план на завтра. Свои испытания добавляются и выключаются в Кодексе.
- **Вкладка «Квесты»**:
  - **Босс недели**: новый каждый понедельник, +400 опыта.
  - **Копилка в гривнах** с целью: подушка безопасности и переезд.
  - **11 сюжетных путей**:
    - Системный человек
    - Рельефное тело
    - Здоровье и биохимия
    - Капитал в гривнах
    - Инвестиции и крипто
    - Зарплата $1000+
    - ИИ и вайбкодинг
    - ACE
    - Отношения с Дианой
    - Переезд
    - Порядок в жилье
- **Прогресс квестов** хранится в `system_state`, поэтому попадает в экспорт и импорт JSON.

Готовый APK для телефона лежит в разделе Releases репозитория (если его туда
загрузили) или собирается командами ниже.

---

## The problem it solves

Habit trackers are boring and easy to abandon. THE SYSTEM makes daily discipline feel
like leveling up a character: complete real tasks, earn XP, climb hunter ranks, and
watch your avatar star visibly grow more powerful over a 180-day journey.

---

## Features

- **Disciplines** — daily quests across 8 life domains (Rise, Rest, Nourish, Silence,
  Forge, Knowledge, Presence, Ritual). Completing grants XP, failing costs XP.
- **XP, Levels & Ranks (E → S)** — your global level rises with XP; rank milestones
  re-theme the whole app.
- **Attributes** — Willpower, Strength, Vitality, Knowledge — derived from what you
  actually logged.
- **Your Star** — pick Antares, Polaris, or Altair as your avatar; it visually evolves
  (glow, ring, motes, corona) as you rank up.
- **180-day journey** — a 24-stage Ascension path ending in a Final Judgement verdict.
- **Mandates** — loot chests (weapons, armor, titles, auras, backgrounds) earned from
  leveling up or weekly petitions.
- **Silence Protocol** — tracks a "days clean" streak; breaking it resets your progress.
- **Shield** — a focus-session mode that keeps the screen awake for deep work.
- **Auto-settlement** — missed days are automatically resolved on next launch.
- **Rich notifications** — scheduled reminders with custom Android banners.
- **Backup** — export/import your whole save as JSON.

---

## Tech stack

React Native (Expo, bare workflow) + Zustand + expo-sqlite, with custom native Android
modules for notifications and usage tracking.

---

## How to build it into an APK

```powershell
cd the-system
npm install
cd android
./gradlew assembleRelease
```

The installable file lands at:

```
the-system/android/app/build/outputs/apk/release/app-release.apk
```

Install it on a phone with a cable plugged in:

```powershell
adb install -r the-system/android/app/build/outputs/apk/release/app-release.apk
```

Or copy the `.apk` to the phone manually (USB / cloud / email), tap it, and allow
**Install unknown apps** when prompted.

This release build is signed with the project's debug keystore — it installs on any
phone without extra setup, but isn't suitable for the Play Store.

> Updating: installing a newer APK over an existing install keeps your save data.
> Only **uninstalling** or **Clear data** wipes progress.

---

*Arise.*
