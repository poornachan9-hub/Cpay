import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  FiSettings,
  FiUser,
  FiShield,
  FiDollarSign,
  FiBell,
  FiGlobe,
  FiSave,
  FiRefreshCw,
  FiAlertTriangle,
  FiCheck,
  FiX,
  FiEdit3,
} from "react-icons/fi";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import { contractService } from "../services/contract";
import { MAX_FEE_RATE, isAdminAddress } from "../lib/constants";
import toast from "react-hot-toast";
import ABI from "../web3/artifacts/contracts/CryptoPaymentGateway.sol/CryptoPaymentGateway.json";

const Settings = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [settings, setSettings] = useState({
    platformFee: "250", // 2.5%
    notifications: {
      email: true,
      push: true,
      transactions: true,
      payouts: true,
      kyc: true,
    },
    privacy: {
      publicProfile: false,
      showTransactions: false,
      analyticsSharing: true,
    },
    security: {
      twoFactorEnabled: false,
      sessionTimeout: "30",
    },
  });

  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [reviewers, setReviewers] = useState([]);
  const [newReviewer, setNewReviewer] = useState("");

  // Mock ABI - replace with your actual ABI
  const CONTRACT_ABI = ABI.abi;

  useEffect(() => {
    if (isConnected && address) {
      loadSettings();
    }
  }, [isConnected, address]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const contract = contractService.getReadOnlyContract(CONTRACT_ABI);

      // Check if user is owner
      try {
        let isUserAdmin = isAdminAddress(address);
        try {
          const owner = await contract.owner();
          if (owner && owner.toLowerCase() === address.toLowerCase()) {
            isUserAdmin = true;
          }
        } catch (e) {
          console.warn("Could not query contract owner:", e);
        }
        setIsOwner(isUserAdmin);

        // Load platform fee if owner
        if (isUserAdmin) {
          try {
            const feeRate = await contract.platformFeeRate();
            setSettings((prev) => ({
              ...prev,
              platformFee: feeRate.toString(),
            }));
          } catch (feeErr) {
            console.warn("Could not read platform fee:", feeErr);
          }
        }
      } catch (error) {
        console.error("Error checking owner status:", error);
        if (isAdminAddress(address)) {
          setIsOwner(true);
        }
      }

      // Load other settings from localStorage or API
      const savedSettings = localStorage.getItem(`settings-${address}`);
      if (savedSettings) {
        setSettings((prev) => ({
          ...prev,
          ...JSON.parse(savedSettings),
        }));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);

      // Save platform fee if owner and changed
      if (isOwner && walletClient) {
        const contract = await contractService.getContractWithWagmi(
          walletClient,
          CONTRACT_ABI
        );
        const currentFee = await contract.platformFeeRate();

        if (currentFee.toString() !== settings.platformFee) {
          const result = await contractService.updatePlatformFee(
            contract,
            parseInt(settings.platformFee)
          );
          if (!result.success) {
            toast.error("Failed to update platform fee");
            return;
          }
        }
      }

      // Save other settings to localStorage
      localStorage.setItem(`settings-${address}`, JSON.stringify(settings));

      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const addReviewer = async () => {
    try {
      if (!walletClient || !isOwner) {
        toast.error("Only owners can add reviewers");
        return;
      }

      if (!newReviewer || !newReviewer.match(/^0x[a-fA-F0-9]{40}$/)) {
        toast.error("Please enter a valid Ethereum address");
        return;
      }

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );
      const result = await contractService.addReviewer(contract, newReviewer);

      if (result.success) {
        toast.success("Reviewer added successfully!");
        setReviewers((prev) => [...prev, newReviewer]);
        setNewReviewer("");
      } else {
        toast.error("Failed to add reviewer");
      }
    } catch (error) {
      console.error("Error adding reviewer:", error);
      toast.error("Failed to add reviewer");
    }
  };

  const removeReviewer = async (reviewerAddress) => {
    try {
      if (!walletClient || !isOwner) {
        toast.error("Only owners can remove reviewers");
        return;
      }

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );
      const result = await contractService.removeReviewer(
        contract,
        reviewerAddress
      );

      if (result.success) {
        toast.success("Reviewer removed successfully!");
        setReviewers((prev) => prev.filter((addr) => addr !== reviewerAddress));
      } else {
        toast.error("Failed to remove reviewer");
      }
    } catch (error) {
      console.error("Error removing reviewer:", error);
      toast.error("Failed to remove reviewer");
    }
  };

  const emergencyPause = async () => {
    try {
      if (!walletClient || !isOwner) {
        toast.error("Only owners can pause the contract");
        return;
      }

      const contract = contractService.getContract(walletClient, CONTRACT_ABI);
      const result = await contractService.emergencyPause(contract);

      if (result.success) {
        toast.success("Contract paused successfully!");
      } else {
        toast.error("Failed to pause contract");
      }
    } catch (error) {
      console.error("Error pausing contract:", error);
      toast.error("Failed to pause contract");
    }
  };

  const emergencyUnpause = async () => {
    try {
      if (!walletClient || !isOwner) {
        toast.error("Only owners can unpause the contract");
        return;
      }

      const contract = contractService.getContract(walletClient, CONTRACT_ABI);
      const result = await contractService.emergencyUnpause(contract);

      if (result.success) {
        toast.success("Contract unpaused successfully!");
      } else {
        toast.error("Failed to unpause contract");
      }
    } catch (error) {
      console.error("Error unpausing contract:", error);
      toast.error("Failed to unpause contract");
    }
  };

  const tabs = [
    { id: "general", name: "General", icon: FiSettings },
    { id: "notifications", name: "Notifications", icon: FiBell },
    { id: "privacy", name: "Privacy", icon: FiShield },
    { id: "security", name: "Security", icon: FiUser },
    ...(isOwner ? [{ id: "admin", name: "Admin", icon: FiDollarSign }] : []),
  ];

  if (loading) {
    return (
      <Layout title="Settings">
        <div className="flex items-center justify-center h-64">
          <FiRefreshCw className="animate-spin h-8 w-8 text-blue-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Settings">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">
              Manage your account and platform preferences
            </p>
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50"
          >
            {saving ? (
              <>
                <FiRefreshCw className="animate-spin h-4 w-4 mr-2" />
                Saving...
              </>
            ) : (
              <>
                <FiSave className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <tab.icon className="h-4 w-4 mr-3" />
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {activeTab === "general" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      General Settings
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Wallet Address
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={address || ""}
                            disabled
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(address);
                              toast.success("Address copied to clipboard");
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Language
                        </label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                          <option>English (US)</option>
                          <option>English (UK)</option>
                          <option>Spanish</option>
                          <option>French</option>
                          <option>German</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Timezone
                        </label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                          <option>UTC</option>
                          <option>America/New_York</option>
                          <option>America/Los_Angeles</option>
                          <option>Europe/London</option>
                          <option>Asia/Tokyo</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "notifications" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Notification Preferences
                    </h3>

                    <div className="space-y-4">
                      {Object.entries(settings.notifications).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between"
                          >
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 capitalize">
                                {key.replace(/([A-Z])/g, " $1").trim()}
                              </h4>
                              <p className="text-sm text-gray-500">
                                Receive notifications for {key.toLowerCase()}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                setSettings((prev) => ({
                                  ...prev,
                                  notifications: {
                                    ...prev.notifications,
                                    [key]: !value,
                                  },
                                }))
                              }
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                value ? "bg-blue-600" : "bg-gray-200"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  value ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "privacy" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Privacy Settings
                    </h3>

                    <div className="space-y-4">
                      {Object.entries(settings.privacy).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between"
                        >
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 capitalize">
                              {key.replace(/([A-Z])/g, " $1").trim()}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {key === "publicProfile" &&
                                "Allow others to view your profile"}
                              {key === "showTransactions" &&
                                "Show your transactions publicly"}
                              {key === "analyticsSharing" &&
                                "Share analytics data for platform improvement"}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              setSettings((prev) => ({
                                ...prev,
                                privacy: {
                                  ...prev.privacy,
                                  [key]: !value,
                                },
                              }))
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              value ? "bg-blue-600" : "bg-gray-200"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                value ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "security" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Security Settings
                    </h3>

                    <div className="space-y-6">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <FiShield className="h-5 w-5 text-yellow-600 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-medium text-yellow-800">
                              Wallet Security
                            </h4>
                            <p className="text-sm text-yellow-700 mt-1">
                              Your wallet connection provides the primary
                              security for this application. Always verify
                              transactions before signing.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Session Timeout (minutes)
                        </label>
                        <select
                          value={settings.security.sessionTimeout}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              security: {
                                ...prev.security,
                                sessionTimeout: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="15">15 minutes</option>
                          <option value="30">30 minutes</option>
                          <option value="60">1 hour</option>
                          <option value="120">2 hours</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "admin" && isOwner && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Platform Administration
                    </h3>

                    <div className="space-y-6">
                      {/* Platform Fee */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Platform Fee Rate (basis points)
                        </label>
                        <div className="flex items-center space-x-4">
                          <input
                            type="number"
                            min="0"
                            max={MAX_FEE_RATE}
                            value={settings.platformFee}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                platformFee: e.target.value,
                              }))
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <span className="text-sm text-gray-500">
                            {(parseInt(settings.platformFee) / 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Maximum: {MAX_FEE_RATE} basis points (
                          {MAX_FEE_RATE / 100}%)
                        </p>
                      </div>

                      {/* KYC Reviewers */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">
                          KYC Reviewers
                        </h4>
                        <div className="space-y-3">
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              value={newReviewer}
                              onChange={(e) => setNewReviewer(e.target.value)}
                              placeholder="0x... reviewer address"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                              onClick={addReviewer}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Add
                            </button>
                          </div>

                          {reviewers.length > 0 && (
                            <div className="space-y-2">
                              {reviewers.map((reviewer, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                                >
                                  <span className="font-mono text-sm">
                                    {reviewer}
                                  </span>
                                  <button
                                    onClick={() => removeReviewer(reviewer)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <FiX className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Emergency Controls */}
                      <div className="border-t border-gray-200 pt-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">
                          Emergency Controls
                        </h4>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-start space-x-3">
                            <FiAlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                            <div className="flex-1">
                              <h5 className="text-sm font-medium text-red-800">
                                Contract Controls
                              </h5>
                              <p className="text-sm text-red-700 mt-1 mb-3">
                                Use these controls only in emergency situations.
                                Pausing will stop all contract operations.
                              </p>
                              <div className="flex space-x-3">
                                <button
                                  onClick={emergencyPause}
                                  className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                                >
                                  Emergency Pause
                                </button>
                                <button
                                  onClick={emergencyUnpause}
                                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  Unpause
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
