// apps/frontend/src/pages/Admin.tsx
import { useState, useEffect } from "react";
import { useAuth } from "@/services/auth";
import { useNavigate } from "@tanstack/react-router";
import {
  Users,
  Shield,
  UserCheck,
  Search,
  ShieldCheck,
  UserX,
  User,
  Trash2,
} from "lucide-react";
import { ChartCard } from "@/components/ChartCard";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { loginHistory: number };
}

export function Admin() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
  });
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchUsers = async (searchVal?: string, roleVal?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const s = searchVal ?? search;
      const r = roleVal ?? roleFilter;
      if (s) params.set("search", s);
      if (r) params.set("role", r);
      params.set("limit", "50");

      const res = await fetch(`${API_BASE}/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
        setTotal(data.total);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.totalUsers !== undefined) {
        setStats({
          totalUsers: data.totalUsers,
          activeUsers: data.activeUsers,
          adminUsers: data.adminUsers,
        });
      }
    } catch {}
  };

  if (user?.role !== "ADMIN") {
    navigate({ to: "/" });
    return null;
  }

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("Failed");
      setMessage({ type: "success", text: "Role updated" });
      fetchUsers();
      fetchStats();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    }
  };

  const handleToggleActive = async (userId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/admin/users/${userId}/toggle-active`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed");
      setMessage({ type: "success", text: "User status updated" });
      fetchUsers();
      fetchStats();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMessage({ type: "success", text: data.message || "User deleted" });
      setDeleteConfirm(null);
      fetchUsers();
      fetchStats();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Admin Panel
        </h2>
        <p className="text-sm text-gray-900 dark:text-white mt-1 font-medium">
          Manage users and system settings
        </p>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
            message.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800"
              : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ChartCard title="Total Users">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-blue-500" />
            <span className="text-2xl font-semibold text-gray-900 dark:text-white">
              {stats.totalUsers}
            </span>
          </div>
        </ChartCard>
        <ChartCard title="Active Users">
          <div className="flex items-center gap-3">
            <UserCheck size={20} className="text-emerald-500" />
            <span className="text-2xl font-semibold text-gray-900 dark:text-white">
              {stats.activeUsers}
            </span>
          </div>
        </ChartCard>
        <ChartCard title="Admins">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-amber-500" />
            <span className="text-2xl font-semibold text-gray-900 dark:text-white">
              {stats.adminUsers}
            </span>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Users">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchUsers();
              }}
              className="flex-1 text-sm text-gray-900 dark:text-white bg-transparent outline-none placeholder:text-gray-400"
              placeholder="Search users..."
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => {
              const newRole = e.target.value;
              setRoleFilter(newRole);
              fetchUsers(search, newRole);
            }}
            className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none"
          >
            <option value="">All Roles</option>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            onClick={() => fetchUsers()}
            className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition"
          >
            Search
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading...
          </div>
        ) : users.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No users found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs border-b border-gray-100 dark:border-gray-800">
                  <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white">
                    User
                  </th>
                  <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white">
                    Role
                  </th>
                  <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white">
                    Status
                  </th>
                  <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white hidden md:table-cell">
                    Logins
                  </th>
                  <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white hidden md:table-cell">
                    Joined
                  </th>
                  <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white w-10"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                          <User
                            size={14}
                            className="text-gray-500 dark:text-gray-300"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {u.name || "—"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={u.id === user.id}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg border outline-none transition-colors ${
                          u.role === "ADMIN"
                            ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                            : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                        } ${u.id === user.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td className="py-3 px-2">
                      <button
                        onClick={() => handleToggleActive(u.id)}
                        disabled={u.id === user.id}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border transition-all duration-200 ${
                          u.isActive
                            ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                            : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50"
                        } ${u.id === user.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {u.isActive ? (
                          <>
                            <ShieldCheck size={12} /> Active
                          </>
                        ) : (
                          <>
                            <UserX size={12} /> Disabled
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-2 text-gray-900 dark:text-white tabular-nums hidden md:table-cell">
                      {u._count.loginHistory}
                    </td>
                    <td className="py-3 px-2 text-gray-500 dark:text-gray-400 text-xs hidden md:table-cell">
                      {new Date(u.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-2">
                      {deleteConfirm === u.id ? (
                        <div className="flex items-center gap-1 animate-slideDown">
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="px-2 py-1 text-xs font-semibold text-white bg-red-600 rounded hover:bg-red-700 transition-all duration-200 active:scale-95"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : u.id === user.id ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(u.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200 hover:scale-110 active:scale-95"
                          title="Delete user"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
          Showing {users.length} of {total} users
        </div>
      </ChartCard>
    </div>
  );
}
