
# leave-management

leave-management web application built using PostgreSQL, Express.js,
React, and Node.js.

## Overview

The Leave Management System provides separate access for employees and administrators through dedicated URLs.

Employees can apply for leave and track their requests, while administrators can review submitted applications and approve or reject them

## Features

- User-friendly React interface
- RESTful APIs using Express.js and Node.js
- PostgreSQL database integration
- Input validation and error handling

## Tech Stack

- **Frontend:** React, JavaScript, HTML, CSS
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL
- **API:** REST API
- **Version Control:** Git and GitHub

## Project Structure

leave-management/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.js
│   └── package.json
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── package.json
│   └── server.js
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js and npm
- PostgreSQL
- Git

## Getting Started

### 1. Clone the repository

```bash
git clone GITHUB_REPOSITORY_URL
cd leave-management
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Install backend dependencies

```bash
cd ../backend
npm install
```

### 4. Configure environment variables

Create the required environment files based on your application.

Example backend `.env` variables:

```env
PORT=5000
DATABASE_URL=your_local_database_connection_string
JWT_SECRET=replace_with_a_secure_secret
```

Use the actual variable names expected by your code.
Never commit real secrets.

### 5. Set up the database

Create the required PostgreSQL database and apply the
schema, migrations, or SQL setup scripts used by your project.

### 6. Run the application

Open separate terminals for the backend and frontend.
Use the development scripts defined in each package.json.


## Environment Variables

PORT=5000
DB_HOST=localhost
DB_PORT=
DB_USER=postgres
DB_PASSWORD=
DB_NAME=
JWT_SECRET=
CLIENT_URL=http://localhost:5173

## Future Improvements

- Add automated tests
- Email notifications for leave request decisions.
- Improve error handling
- Add additional features as needed

## Author

Shivam Mishra
