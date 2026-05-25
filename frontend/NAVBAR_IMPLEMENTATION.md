# Dynamic Navbar Implementation

## Overview

A dynamic navbar has been implemented across all HTML files in the Swarnika Jewels project. The navbar displays the logged-in user's name and toggles between Login and Logout buttons based on authentication state using Firebase Auth.

## Features

### 1. **User Authentication Display**

- Shows "Hi, [Username]" when a user is logged in
- Displays the user's display name or email username
- Hidden when user is not logged in

### 2. **Dynamic Login/Logout Buttons**

- **Login Button**: Visible when user is NOT logged in
- **Logout Button**: Visible when user IS logged in
- Automatically toggles based on Firebase Auth state

### 3. **Consistent Across All Pages**

The navbar is standardized across all HTML files:

- `index.html`
- `cart.html`
- `product.html`
- `orders.html`
- `profile.html`
- `admin.html`
- `order-details.html`
- `register.html`
- `login.html`

## Implementation Details

### Files Modified/Created

#### **navbar.js** (NEW)

Location: `/frontend/navbar.js`

This is the core script that manages the dynamic navbar behavior:

- Listens to Firebase Auth state changes
- Updates navbar UI elements based on authentication status
- Handles logout functionality
- Displays user's name from Firebase Auth

**Key Functions:**

```javascript
- initNavbar() - Initializes the navbar after Firebase Auth loads
- updateNavbarUI(user) - Updates UI based on user authentication state
```

#### **HTML Files Updated**

All HTML files now include:

```html
<script type="module" src="firebase.js" defer></script>
<script defer src="navbar.js"></script>
```

### Navbar Structure

```html
<nav class="navbar navbar-expand-lg navbar-light bg-light">
  <div class="container">
    <a
      class="navbar-brand fw-bold d-flex align-items-center gap-2"
      href="index.html"
    >
      <img src="image.png" alt="Swarnika Logo" class="brand-logo" />
      <span>Swarnika Jewels</span>
    </a>
    <button
      class="navbar-toggler"
      type="button"
      data-bs-toggle="collapse"
      data-bs-target="#navbarNav"
    >
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="navbarNav">
      <ul class="navbar-nav ms-auto">
        <li class="nav-item"><a class="nav-link" href="index.html">Home</a></li>
        <li class="nav-item">
          <a class="nav-link" href="cart.html"
            >Cart <span class="cart-count"></span
          ></a>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="orders.html">Orders</a>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="profile.html">Profile</a>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="admin.html">Admin Panel</a>
        </li>

        <!-- User name display (hidden when not logged in) -->
        <li class="nav-item d-none" id="userNameDisplay">
          <span class="nav-link text-primary fw-bold"></span>
        </li>

        <!-- Login button (visible when not logged in) -->
        <li class="nav-item">
          <a class="nav-link" id="loginBtn" href="login.html">Login</a>
        </li>

        <!-- Logout button (hidden when not logged in) -->
        <li class="nav-item d-none" id="logoutContainer">
          <a class="nav-link" href="#" id="logoutBtn">Logout</a>
        </li>
      </ul>
    </div>
  </div>
</nav>
```

## How It Works

### Authentication Flow

1. **Page Load**

   - `firebase.js` initializes Firebase Auth
   - `navbar.js` waits for Firebase Auth to be available
   - Listens to `onAuthStateChanged` event

2. **User Logged In**

   - `loginBtn` gets `d-none` class (hidden)
   - `userNameDisplay` removes `d-none` class (visible)
   - `logoutContainer` removes `d-none` class (visible)
   - User's name is displayed

3. **User Logged Out**

   - `loginBtn` removes `d-none` class (visible)
   - `userNameDisplay` gets `d-none` class (hidden)
   - `logoutContainer` gets `d-none` class (hidden)

4. **Logout Action**
   - Calls `auth.signOut()`
   - Redirects to `index.html`
   - Navbar automatically updates to logged-out state

## Usage

### For Developers

The navbar is automatically functional on all pages. No additional code needed in individual HTML files.

### Testing

1. **Not Logged In State:**

   - Open any page
   - Should see "Login" button
   - Should NOT see user name or "Logout" button

2. **Logged In State:**

   - Login through `login.html`
   - Navigate to any page
   - Should see "Hi, [Username]"
   - Should see "Logout" button
   - Should NOT see "Login" button

3. **Logout:**
   - Click "Logout" button
   - Should redirect to homepage
   - Should return to "not logged in" state

## Dependencies

- **Firebase Auth** (`firebase.js`)
- **Bootstrap 5.3+** (for navbar styling)
- **jQuery** (not required - pure vanilla JS)

## Browser Compatibility

Works on all modern browsers:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

### Navbar not updating

- Check browser console for errors
- Ensure `firebase.js` is loaded before `navbar.js`
- Verify Firebase configuration is correct

### User name not showing

- Check if user has `displayName` set in Firebase Auth
- Falls back to email username if no display name

### Logout not working

- Check Firebase Auth is properly initialized
- Verify network connection
- Check browser console for errors

## Future Enhancements

Potential improvements:

1. Add loading spinner while checking auth state
2. Add user profile picture/avatar
3. Add dropdown menu for user settings
4. Add notification badge
5. Add role-based menu items (admin vs regular user)

## Support

For issues or questions, contact the development team or check the Firebase Auth documentation.
