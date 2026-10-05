import { useState, useEffect } from "react";
import { FiUsers, FiDownload, FiUserPlus } from "react-icons/fi";

const UsersTab = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
        <div className="flex space-x-3">
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <FiDownload className="h-4 w-4 mr-2" />
            Export Users
          </button>
          <button className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <FiUserPlus className="h-4 w-4 mr-2" />
            Bulk Actions
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <FiUsers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h4 className="font-medium text-gray-900 mb-2">
          Advanced User Management
        </h4>
        <p className="text-gray-600 mb-4">
          For detailed user management, please visit the dedicated Users page.
        </p>
        <a
          href="/users"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiUsers className="h-4 w-4 mr-2" />
          Go to Users Page
        </a>
      </div>
    </div>
  );
};

export default UsersTab;
