# ✨ Yaduvanshi Desk

### Your Work. One Workspace.

A focused, local-first workspace to create, organize, and manage your records — with a clean interface, intuitive workflows, and browser-based data storage.

---

## Overview

**Yaduvanshi Desk** is a browser-based record management application designed to make everyday information organization simple and efficient.

It provides a centralized workspace where users can create and manage records, organize information by category and status, track priorities, and keep their workspace organized through search, filtering, sorting, and pagination.

Built with **HTML, CSS, and Vanilla JavaScript**, the application uses browser storage technologies to keep its data locally, without requiring a backend or user account.

The project focuses on a polished user experience, responsive design, practical productivity features, and local data management.

---

## Features

### Workspace & Dashboard
- Clean welcome screen and workspace interface.
- Dashboard for accessing and managing records.
- Dedicated views for all records, priority items, archived records, and recycled records.
- Organized navigation for a consistent workflow.

### Record Management
- Create new records.
- View and update existing records.
- Delete records.
- Duplicate existing records.
- Organize records using categories, statuses, and priorities.
- Manage due dates and record details.

### Organization & Productivity
- Search records.
- Filter records using available criteria.
- Sort records for easier navigation.
- Paginate record listings.
- Archive records to keep the active workspace organized.
- Restore archived records.
- Manage deleted records through the Recycle Bin.
- Restore recycled records or remove them permanently.
- Perform bulk actions where supported.

### Data Management
- Import records using JSON files.
- Export records for backup and portability.
- Store records locally using IndexedDB.
- Persist user preferences using LocalStorage.
- Maintain session-specific interface state using SessionStorage.

### Appearance & Usability
- Light and dark themes.
- Responsive layouts for desktop, tablet, and mobile devices.
- Responsive navigation.
- Reusable interface components and consistent visual styling.
- Dialogs and toast messages for user feedback.
- Form validation and accessible interface controls.

---

## Application Navigation

Yaduvanshi Desk provides dedicated workspace sections through its navigation system.

| Route | Description |
|---|---|
| `/` | Welcome screen |
| `/#dashboard` | Main dashboard |
| `/#records` | All records |
| `/#priority` | Priority records |
| `/#archive` | Archived records |
| `/#recycle-bin` | Recycled records |

---

## Technology Stack

The project is built using browser-native technologies without a frontend framework or build system.

| Technology | Purpose |
|---|---|
| HTML5 | Application structure and semantic markup |
| CSS3 | Layout, responsive design, themes, and styling |
| JavaScript (ES6+) | Application logic and interactions |
| IndexedDB | Persistent local record storage |
| LocalStorage | Persistent user preferences |
| SessionStorage | Session-specific interface state |
| SVG | Scalable interface and application icons |

---

## Project Structure

```text
Yaduvanshi-Desk/
│
├── index.html
├── favicon.svg
├── README.md
│
├── css/
│   ├── layout.css
│   ├── composer.css
│   ├── theme.css
│   └── productivity.css
│
└── js/
    ├── app.js
    ├── db.js
    ├── storage.js
    └── theme.js
```

### File Responsibilities

| File | Responsibility |
|---|---|
| `index.html` | Main application markup and entry point |
| `favicon.svg` | Application favicon |
| `css/layout.css` | Main layout, navigation, and responsive styling |
| `css/composer.css` | Record creation and editing interface styling |
| `css/theme.css` | Light and dark theme styling |
| `css/productivity.css` | Dashboard, records, and productivity interface styling |
| `js/app.js` | Main application logic and user interactions |
| `js/db.js` | IndexedDB database operations |
| `js/storage.js` | LocalStorage preferences and SessionStorage state management |
| `js/theme.js` | Theme switching functionality |

---

## Getting Started

### Prerequisites

- A modern web browser.
- Visual Studio Code or another code editor.
- Live Server extension for Visual Studio Code.

### Run Locally

**1. Clone the repository**

```bash
git clone <repository-url>
```

**2. Open the project folder**

```bash
cd Yaduvanshi-Desk
```

**3. Open the folder in Visual Studio Code**

```bash
code .
```

**4. Start the application**

Open `index.html` using the Live Server extension.

The application will open in your browser.

> No package installation, build command, or backend server is required.

---

## Data Storage & Privacy

Yaduvanshi Desk follows a **local-first storage approach**. Its application data is stored in the browser rather than being sent to a project backend.

### Storage Architecture

| Storage | Identifier | Purpose |
|---|---|---|
| IndexedDB | `YaduvanshiDB` | Persistent record storage |
| IndexedDB Object Store | `records` | Stores application records |
| LocalStorage | `yaduvanshi.preferences.v1` | Stores user preferences |
| SessionStorage | `yaduvanshi.session.screen.v1` | Stores session-specific screen state |

### Database Information

- Database name: `YaduvanshiDB`
- Database version: `1`
- Object store: `records`

### Important Storage Notes

- Records are stored locally in the browser using IndexedDB.
- User preferences are stored using the `yaduvanshi.preferences.v1` LocalStorage key.
- Session-specific interface state uses the `yaduvanshi.session.screen.v1` SessionStorage key.
- The application does not require an account or backend to use its local workspace.
- Browser storage is specific to the website origin.

For example, these addresses maintain separate browser storage:

```text
http://127.0.0.1:5500
http://localhost:5501
```

Using a different hostname or port can make previously stored records appear unavailable because the browser treats each origin separately.

### Backup & Data Portability

Use the application's JSON export feature to create a backup of your records.

To transfer records between different browser origins:

1. Open the original workspace.
2. Export your records as a JSON file.
3. Open Yaduvanshi Desk using the destination origin.
4. Import the exported JSON file.

**Import consideration:** Records are stored using their identifiers. If an imported record has an identifier that already exists, the database's `put` operation replaces the existing record with the imported record. Export a backup before importing data, particularly when combining records from different workspaces.

### Data Migration

The application uses its current Yaduvanshi Desk storage identifiers. It does not automatically migrate records from legacy database names or legacy preference keys.

**Important:** Export a JSON backup before clearing browser data, changing your development URL, or making significant storage changes.

---

## Record Validation

The application uses validation to help maintain consistent record data.

Record fields include:

| Field | Purpose |
|---|---|
| Title | Identifies the record |
| Description | Provides additional information |
| Category | Organizes records |
| Status | Represents the record's current state |
| Priority | Indicates its importance |
| Due Date | Helps track deadlines |

### Available Statuses

- To Do
- In Progress
- Completed

### Available Priorities

- Low
- Medium
- High

---

## Accessibility & Responsive Design

The interface is designed to remain usable across different screen sizes and input methods.

- Responsive layouts for desktop, tablet, and mobile devices.
- Navigation adapted for smaller screens.
- Consistent visual hierarchy and readable content.
- Semantic HTML structure.
- Accessible interface controls and clear interaction feedback.
- Light and dark appearance options.

---

## Implementation Notes

- Built with browser-native technologies.
- Uses Vanilla JavaScript and ES6+ features.
- Uses IndexedDB for persistent record data.
- Uses LocalStorage and SessionStorage for browser-side state.
- Does not depend on a frontend framework.
- Does not require a backend or database server.
- Uses JSON for record export and import.
- Browser storage remains subject to the browser's storage policies and user-controlled data clearing.
- Google Fonts, if loaded externally, require an internet connection.

---

## Future Scope

The application can be extended with additional capabilities in future versions, such as:

- Cloud synchronization.
- User authentication.
- Multi-device access.
- Advanced reporting.
- Additional productivity workflows.

These are potential future enhancements and are not presented as existing features.

---

## Author

**Ravi Yadav**

---