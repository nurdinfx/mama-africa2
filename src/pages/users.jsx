// src/pages/Users.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { realApi } from '../api/realApi';

import { useOptimisticData } from '../hooks/useOptimisticData';

const Users = () => {
  // Use optimistic data fetching
  const {
    data: users,
    loading,
    error: hookError,
    refresh: loadUsers
  } = useOptimisticData('users_list', async () => {
    const response = await realApi.getUsers();
    if (response.success) {
      const raw = realApi.extractData(response) || [];
      // Normalize each user to always expose _id for UI consistency
      return (Array.isArray(raw) ? raw : [raw]).map(u => ({ _id: u._id || u.id, ...u }));
    }
    throw new Error(response.message || 'Failed to load users');
  }, []);

  const [filteredUsers, setFilteredUsers] = useState([]);
  // Sorting for date columns
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'

  // const [loading, setLoading] = useState(true); // Handled by hook
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [error, setError] = useState('');

  const { user: currentUser } = useAuth();

  // Sync hook error to local error state if needed
  useEffect(() => {
    if (hookError) setError(hookError.message);
  }, [hookError]);

  // Recompute filtered users whenever the source data or filters change
  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter, sortBy, sortDir]);

  // Listen for local changes to users (so offline-created users show up immediately)
  useEffect(() => {
    const handler = () => {
      try { loadUsers(); } catch (e) { console.warn('Failed to refresh users on update event', e); }
    };

    const storageHandler = (e) => {
      if (e.key === 'users_list') {
        try { loadUsers(); } catch (err) { console.warn('Failed to refresh users on storage event', err); }
      }
    };

    // In-page event for same-tab updates
    window.addEventListener('users-updated', handler);
    // Cross-tab updates trigger 'storage' events
    window.addEventListener('storage', storageHandler);

    return () => {
      window.removeEventListener('users-updated', handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, [loadUsers]);

  // Initial load handled by hook
  // useEffect(() => {
  //   loadUsers();
  // }, []);

  const filterUsers = () => {
    let filtered = Array.isArray(users) ? users.slice() : [];

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.phone || '').toString().includes(searchTerm)
      );
    }

    if (roleFilter) {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Sorting by date fields (createdAt / lastLogin)
    try {
      const dir = sortDir === 'asc' ? 1 : -1;
      filtered.sort((a, b) => {
        const aVal = new Date(a[sortBy] || a.createdAt || 0).getTime();
        const bVal = new Date(b[sortBy] || b.createdAt || 0).getTime();
        return (aVal - bVal) * dir;
      });
    } catch (e) {
      // silent
    }

    setFilteredUsers(filtered);
  };

  const handleSaveUser = async (userData) => {
    try {
      let response;

      if (editingUser) {
        response = await realApi.updateUser(editingUser._id, userData);
      } else {
        response = await realApi.createUser(userData);
      }

      if (response.success) {
        if (response.queued) {
          alert(response.message || 'User saved locally and will sync when online');
        }
        await loadUsers(); // Reload users to get updated data
        setShowModal(false);
        setEditingUser(null);
      } else {
        throw new Error(response.message || 'Failed to save user');
      }
    } catch (error) {
      console.error('Failed to save user:', error);
      alert(error.message || 'Failed to save user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const response = await realApi.deleteUser(userId);

        if (response.success) {
          // Refresh user list to reflect deletion (works for offline and online flows)
          try { await loadUsers(); } catch (e) { console.warn('Failed to refresh users after delete', e); }
        } else {
          throw new Error(response.message || 'Failed to delete user');
        }
      } catch (error) {
        console.error('Failed to delete user:', error);
        alert(error.message || 'Failed to delete user');
      }
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      const response = await realApi.updateUser(userId, { isActive: !currentStatus });

      if (response.success) {
        // Refresh list so changes (including offline queued) are visible
        try { await loadUsers(); } catch (e) { console.warn('Failed to refresh users after status change', e); }
      } else {
        throw new Error(response.message || 'Failed to update user status');
      }
    } catch (error) {
      console.error('Failed to update user status:', error);
      alert(error.message || 'Failed to update user status');
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      manager: 'bg-blue-100 text-blue-800',
      chef: 'bg-green-100 text-green-800',
      cashier: 'bg-purple-100 text-purple-800',
      waiter: 'bg-yellow-100 text-yellow-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleName = (role) => {
    const names = {
      admin: 'Administrator',
      manager: 'Manager',
      chef: 'Chef',
      cashier: 'Cashier',
      waiter: 'Waiter'
    };
    return names[role] || role;
  };

  const roles = ['admin', 'manager', 'chef', 'cashier', 'waiter'];

  // Toggle sort field and direction
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const formatDate = (value) => {
    try {
      if (!value) return '-';
      const d = new Date(value);
      if (isNaN(d)) return '-';
      return d.toLocaleString();
    } catch (e) { return '-'; }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="page-content flex flex-col gap-6 h-full overflow-auto">
      {/* Header */}
      <div className="card bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading-1 text-white mb-2">Users Management</h1>
            <p className="text-blue-100">Manage system users and permissions</p>
            {!navigator.onLine && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm">
                You are <strong>offline</strong>. New users created here will be stored locally and can sign in on this device. They'll sync with the server when online.
              </div>
            )}
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
          <button
            onClick={() => { setEditingUser(null); setShowModal(true); }}
            className="bg-white text-blue-600 px-6 py-2.5 rounded-lg font-medium shadow-sm hover:bg-blue-50 transition-colors"
          >
            + Add User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by name, username, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Roles</option>
              {roles.map(role => (
                <option key={role} value={role}>{getRoleName(role)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setSearchTerm(''); setRoleFilter(''); }}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card p-0 overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto flex-1">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <button onClick={() => toggleSort('lastLogin')} className="flex items-center gap-2">
                    Last Login {sortBy === 'lastLogin' && (sortDir === 'asc' ? '▲' : '▼')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <button onClick={() => toggleSort('createdAt')} className="flex items-center gap-2">
                    Created {sortBy === 'createdAt' && (sortDir === 'asc' ? '▲' : '▼')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map(u => (
                <tr key={u._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <span>{u.name}</span>
                      {u.isLocal && (
                        <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 border border-yellow-200">Local (Offline)</span>
                      )}
                      {u.isOfflineUpdate && (
                        <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-800 border border-orange-200">Pending Sync</span>
                      )}
                      {u.isDeleted && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">Deleted</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.username}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.phone}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(u.role)}`}>{getRoleName(u.role)}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`font-medium ${u.isActive ? 'text-green-600' : 'text-red-600'}`}>{u.isActive ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.lastLogin ? formatDate(u.lastLogin) : 'Never'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(u.createdAt)}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingUser(u); setShowModal(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleUserStatus(u._id, u.isActive)}
                        className={`${u.isActive ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} text-white px-3 py-1 rounded`}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      {u._id !== currentUser?._id && (
                        <button
                          onClick={() => handleDeleteUser(u._id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <UserModal
          user={editingUser}
          onClose={() => { setShowModal(false); setEditingUser(null); }}
          onSave={handleSaveUser}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

// User Modal Component
const UserModal = ({ user, onClose, onSave, currentUser }) => {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    role: 'waiter',
    phone: '',
    address: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        role: user.role || 'waiter',
        phone: user.phone || '',
        address: user.address || '',
        password: '',
        confirmPassword: ''
      });
    }
  }, [user]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (!/^[a-zA-Z0-9._-]{3,}$/.test(formData.username)) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    }

    if (!user && !formData.password) {
      newErrors.password = 'Password is required';
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      const { confirmPassword, ...userData } = formData;
      onSave(userData);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const roles = [
    { value: 'admin', label: 'Administrator' },
    { value: 'manager', label: 'Manager' },
    { value: 'chef', label: 'Chef' },
    { value: 'cashier', label: 'Cashier' },
    { value: 'waiter', label: 'Waiter' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {user ? 'Edit User' : 'Add New User'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!navigator.onLine && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm">
                <strong>Offline:</strong> You're offline. Creating this user will store the account locally — they can sign in on this device while offline. The account will sync to the server when the device reconnects.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full border rounded-lg px-3 py-2 ${errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username *
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className={`w-full border rounded-lg px-3 py-2 ${errors.username ? 'border-red-300' : 'border-gray-300'
                  }`}
              />
              {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full border rounded-lg px-3 py-2 ${errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={`w-full border rounded-lg px-3 py-2 ${errors.phone ? 'border-red-300' : 'border-gray-300'
                  }`}
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {roles.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            {!user && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full border rounded-lg px-3 py-2 ${errors.password ? 'border-red-300' : 'border-gray-300'
                      }`}
                  />
                  {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`w-full border rounded-lg px-3 py-2 ${errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                      }`}
                  />
                  {errors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              </>
            )}

            {user && (
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-700">
                  Leave password fields empty to keep current password
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {user ? 'Update' : 'Create'} User
              </button>
            </div>
          </form>
        </div>
      </div >
    </div >
  );
};

export default Users;
