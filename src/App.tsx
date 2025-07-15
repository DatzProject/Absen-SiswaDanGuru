import React, { useState, useEffect, useRef } from "react";

const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbytSgzE0CuHug2zyLLaiKsmG-O2VyR73Mg20OwvjesIaEGAOxfnuXdhvu0MrnJyk4O-/exec";

interface Attendance {
  id: number;
  date: string;
  time: string;
  class: string;
  name: string;
  nisn: string;
  photo: string | null;
  status: string;
}

interface StudentData {
  nisn: string;
  name: string;
  class: string;
}

interface FormState {
  date: string;
  time: string;
  class: string;
  name: string;
  nisn: string;
  photo: string | null;
  photoBase64: string | null;
  error: string;
  loading: boolean;
}

interface StudentFormState {
  nisn: string;
  name: string;
  class: string;
  error: string;
  loading: boolean;
}

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<"form" | "data" | "students">(
    "form"
  );
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [studentData, setStudentData] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>({
    date: "",
    time: "",
    class: "",
    name: "",
    nisn: "",
    photo: null,
    photoBase64: null,
    error: "",
    loading: false,
  });
  const [studentForm, setStudentForm] = useState<StudentFormState>({
    nisn: "",
    name: "",
    class: "",
    error: "",
    loading: false,
  });
  const [editStudent, setEditStudent] = useState<StudentData | null>(null);
  const [deleteStudentNisn, setDeleteStudentNisn] = useState<string | null>(
    null
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const now = new Date();
    const offset = 8 * 60; // WITA offset in minutes
    const witaDate = new Date(now.getTime() + offset * 60 * 1000);
    const date = witaDate.toISOString().split("T")[0];
    const time = witaDate.toISOString().slice(11, 16);
    setForm((prev: FormState): FormState => ({ ...prev, date, time }));

    const fetchStudentData = async () => {
      try {
        const response = await fetch(`${ENDPOINT}?action=getStudentData`);
        if (response.ok) {
          const data = await response.json();
          setStudentData(data.success ? data.data : []);
        }
      } catch (error) {
        console.error("Error fetching student data:", error);
      }
    };
    fetchStudentData();
  }, []);

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${ENDPOINT}?action=getAttendanceData`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAttendanceData(data.data);
        } else {
          console.error("Error fetching attendance data:", data.error);
        }
      }
    } catch (error) {
      console.error("Error fetching attendance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev: FormState): FormState => {
      const updatedForm = { ...prev, [name]: value, error: "" };
      if (name === "name") {
        const selectedStudent = studentData.find((s) => s.name === value);
        if (selectedStudent) {
          updatedForm.nisn = selectedStudent.nisn;
          if (
            updatedForm.class &&
            updatedForm.class !== selectedStudent.class
          ) {
            updatedForm.error = "Kelas tidak sesuai dengan data siswa";
          }
        } else if (updatedForm.class) {
          updatedForm.error = "Nama tidak ditemukan dalam kelas yang dipilih";
        }
      } else if (name === "class") {
        updatedForm.name = "";
        updatedForm.nisn = "";
        const validClass = studentData.some((s) => s.class === value);
        if (!validClass && value) {
          updatedForm.error = "Kelas tidak valid";
        }
      }
      return updatedForm;
    });
  };

  const handleStudentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setStudentForm(
      (prev: StudentFormState): StudentFormState => ({
        ...prev,
        [name]: value,
        error: "",
      })
    );
  };

  const openCameraApp = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const compressImage = (
    file: File,
    targetSizeMB: number = 0.8
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not supported"));
          return;
        }

        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 1280;

        if (width > height && width > MAX_DIMENSION) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.7;
        const minQuality = 0.1;
        const step = 0.1;
        const targetSizeBytes = targetSizeMB * 1024 * 1024;

        const tryCompress = () => {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          const base64 = dataUrl.split(",").slice(-1)[0];
          const byteLength = Math.round((base64.length * 3) / 4);

          if (byteLength <= targetSizeBytes || quality <= minQuality) {
            resolve(base64);
          } else {
            quality -= step;
            setTimeout(tryCompress, 0);
          }
        };

        tryCompress();
      };

      img.onerror = reject;
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            error: "File harus berupa gambar",
          })
        );
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            error: "Ukuran file maksimal 10MB",
          })
        );
        return;
      }

      try {
        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            loading: true,
            error: "Memproses gambar...",
          })
        );

        const base64 = await compressImage(file, 0.8);
        const compressedSizeKB = Math.round((base64.length * 3) / 4 / 1024);
        console.log(`Ukuran gambar setelah kompresi: ${compressedSizeKB} KB`);

        const photoURL = URL.createObjectURL(file);

        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            photo: photoURL,
            photoBase64: base64,
            error: "",
            loading: false,
          })
        );

        event.target.value = "";
      } catch (error) {
        console.error("Error processing file:", error);
        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            error:
              "Gagal memproses file. Coba gunakan gambar yang lebih kecil.",
            loading: false,
          })
        );
      }
    }
  };

  const retakePhoto = () => {
    if (form.photo) {
      URL.revokeObjectURL(form.photo);
    }

    setForm(
      (prev: FormState): FormState => ({
        ...prev,
        photo: null,
        photoBase64: null,
        error: "",
      })
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!form.class || !form.name || !form.nisn) {
      setForm(
        (prev: FormState): FormState => ({
          ...prev,
          error: "Harap lengkapi semua field yang diperlukan",
        })
      );
      return;
    }

    const selectedStudent = studentData.find(
      (s) => s.name === form.name && s.nisn === form.nisn
    );
    if (selectedStudent && form.class !== selectedStudent.class) {
      setForm(
        (prev: FormState): FormState => ({
          ...prev,
          error: "Kelas tidak sesuai dengan data siswa",
        })
      );
      return;
    }

    if (!form.photoBase64) {
      setForm(
        (prev: FormState): FormState => ({
          ...prev,
          error: "Harap unggah foto terlebih dahulu",
        })
      );
      return;
    }

    setForm(
      (prev: FormState): FormState => ({
        ...prev,
        loading: true,
        error: "",
      })
    );

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: form.date,
          time: form.time,
          class: form.class,
          name: form.name,
          nisn: form.nisn,
          photo: form.photoBase64,
          status: "Hadir",
        }),
      });

      console.log("Response type:", response.type);

      if (response.type === "opaque") {
        const newAttendance: Attendance = {
          id: attendances.length + 1,
          date: form.date,
          time: form.time,
          class: form.class,
          name: form.name,
          nisn: form.nisn,
          photo: form.photo,
          status: "Hadir",
        };
        setAttendances((prev) => [...prev, newAttendance]);

        if (form.photo) {
          URL.revokeObjectURL(form.photo);
        }
        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            class: "",
            name: "",
            nisn: "",
            photo: null,
            photoBase64: null,
            error: "",
            loading: false,
          })
        );

        console.log("Absensi berhasil disimpan!");
        alert("Absensi berhasil disimpan!");
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error detail:", error);

      try {
        console.log("Mencoba metode alternatif...");
        const params = new URLSearchParams({
          action: "addAttendance",
          date: form.date,
          time: form.time,
          class: form.class,
          name: form.name,
          nisn: form.nisn,
          photo: form.photoBase64.substring(0, 1000) + "...",
          status: "Hadir",
        });

        const alternativeResponse = await fetch(`${ENDPOINT}?${params}`, {
          method: "GET",
          mode: "no-cors",
        });

        console.log("Alternative response:", alternativeResponse);
        alert("Data berhasil dikirim dengan metode alternatif!");

        if (form.photo) {
          URL.revokeObjectURL(form.photo);
        }
        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            class: "",
            name: "",
            nisn: "",
            photo: null,
            photoBase64: null,
            error: "",
            loading: false,
          })
        );
      } catch (altError) {
        console.error("Alternative method error:", altError);
        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            error: `Gagal menyimpan data. Pastikan:\n1. Koneksi internet stabil\n2. Google Apps Script dapat diakses\n3. Ukuran foto tidak terlalu besar\n\nError: ${error.message}`,
            loading: false,
          })
        );
      }
    }
  };

  const handleAddStudent = async () => {
    if (!studentForm.nisn || !studentForm.name || !studentForm.class) {
      setStudentForm(
        (prev: StudentFormState): StudentFormState => ({
          ...prev,
          error: "Harap lengkapi semua field",
        })
      );
      return;
    }

    if (studentData.some((s) => s.nisn === studentForm.nisn)) {
      setStudentForm(
        (prev: StudentFormState): StudentFormState => ({
          ...prev,
          error: "NISN sudah ada",
        })
      );
      return;
    }

    setStudentForm(
      (prev: StudentFormState): StudentFormState => ({
        ...prev,
        loading: true,
        error: "",
      })
    );

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "addStudent",
          nisn: studentForm.nisn,
          name: studentForm.name,
          class: studentForm.class,
        }),
      });

      console.log("Response type:", response.type);

      if (response.type === "opaque") {
        setStudentData((prev) => [
          ...prev,
          {
            nisn: studentForm.nisn,
            name: studentForm.name,
            class: studentForm.class,
          },
        ]);
        setStudentForm({
          nisn: "",
          name: "",
          class: "",
          error: "",
          loading: false,
        });
        setShowAddModal(false);
        alert("Data siswa berhasil ditambahkan!");
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error adding student:", error);
      setStudentForm(
        (prev: StudentFormState): StudentFormState => ({
          ...prev,
          error: `Gagal menambahkan siswa: ${error.message}`,
          loading: false,
        })
      );
    }
  };

  const handleEditStudent = async () => {
    if (
      !editStudent ||
      !studentForm.nisn ||
      !studentForm.name ||
      !studentForm.class
    ) {
      setStudentForm(
        (prev: StudentFormState): StudentFormState => ({
          ...prev,
          error: "Harap lengkapi semua field",
        })
      );
      return;
    }

    setStudentForm(
      (prev: StudentFormState): StudentFormState => ({
        ...prev,
        loading: true,
        error: "",
      })
    );

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "editStudent",
          originalNisn: editStudent.nisn,
          nisn: studentForm.nisn,
          name: studentForm.name,
          class: studentForm.class,
        }),
      });

      console.log("Response type:", response.type);

      if (response.type === "opaque") {
        setStudentData((prev) =>
          prev.map((s) =>
            s.nisn === editStudent.nisn
              ? {
                  nisn: studentForm.nisn,
                  name: studentForm.name,
                  class: studentForm.class,
                }
              : s
          )
        );
        setStudentForm({
          nisn: "",
          name: "",
          class: "",
          error: "",
          loading: false,
        });
        setShowEditModal(false);
        setEditStudent(null);
        alert("Data siswa berhasil diperbarui!");
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error editing student:", error);
      setStudentForm(
        (prev: StudentFormState): StudentFormState => ({
          ...prev,
          error: `Gagal memperbarui siswa: ${error.message}`,
          loading: false,
        })
      );
    }
  };

  const handleDeleteStudent = async () => {
    if (!deleteStudentNisn) return;

    setStudentForm(
      (prev: StudentFormState): StudentFormState => ({
        ...prev,
        loading: true,
        error: "",
      })
    );

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "deleteStudent",
          nisn: deleteStudentNisn,
        }),
      });

      console.log("Response type:", response.type);

      if (response.type === "opaque") {
        setStudentData((prev) =>
          prev.filter((s) => s.nisn !== deleteStudentNisn)
        );
        setShowDeleteModal(false);
        setDeleteStudentNisn(null);
        alert("Data siswa berhasil dihapus!");
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error deleting student:", error);
      setStudentForm(
        (prev: StudentFormState): StudentFormState => ({
          ...prev,
          error: `Gagal menghapus siswa: ${error.message}`,
          loading: false,
        })
      );
    }
  };

  const handlePageChange = (page: "form" | "data" | "students") => {
    setCurrentPage(page);
    if (page === "data") {
      fetchAttendanceData();
    }
  };

  useEffect(() => {
    return () => {
      if (form.photo) {
        URL.revokeObjectURL(form.photo);
      }
    };
  }, [form.photo]);

  const renderFormPage = () => (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="date"
              name="date"
              value={form.date}
              readOnly
              className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
            />
            <input
              type="time"
              name="time"
              value={form.time}
              readOnly
              className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
            />
          </div>

          <select
            name="class"
            value={form.class}
            onChange={handleInputChange}
            required
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Pilih Kelas</option>
            {studentData
              .map((s) => s.class)
              .filter((cls, index, arr) => arr.indexOf(cls) === index)
              .map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
          </select>

          <select
            name="name"
            value={form.name}
            onChange={handleInputChange}
            required
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Pilih Nama</option>
            {studentData
              .filter((s) => s.class === form.class)
              .map((s) => (
                <option key={s.nisn} value={s.name}>
                  {s.name}
                </option>
              ))}
          </select>

          <input
            type="text"
            name="nisn"
            value={form.nisn}
            onChange={handleInputChange}
            placeholder="NISN"
            required
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />

            {!form.photo && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={openCameraApp}
                  disabled={form.loading}
                  className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition duration-200 flex items-center justify-center disabled:opacity-50"
                >
                  {form.loading ? "⏳ Memproses..." : "📸 Buka Kamera HP"}
                </button>
                <div className="text-xs text-gray-500 text-center">
                  Akan membuka aplikasi kamera HP Anda
                </div>
              </div>
            )}

            {form.photo && (
              <div className="space-y-2">
                <img
                  src={form.photo}
                  alt="Preview foto"
                  className="w-full h-64 object-cover rounded-lg border-2 border-green-300"
                />
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="flex-1 bg-yellow-600 text-white p-2 rounded-lg hover:bg-yellow-700 transition duration-200"
                  >
                    📸 Ambil Ulang
                  </button>
                  <button
                    type="button"
                    onClick={openCameraApp}
                    className="flex-1 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition duration-200"
                  >
                    📷 Foto Lain
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {form.error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg whitespace-pre-line">
            {form.error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!form.photoBase64 || form.loading}
          className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {form.loading ? "⏳ Menyimpan..." : "✅ Tambah Absen"}
        </button>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-700">
          <thead className="text-xs uppercase bg-gray-200">
            <tr>
              <th className="px-4 py-2">Tanggal</th>
              <th className="px-4 py-2">Jam</th>
              <th className="px-4 py-2">Kelas</th>
              <th className="px-4 py-2">Nama</th>
              <th className="px-4 py-2">NISN</th>
              <th className="px-4 py-2">Foto</th>
            </tr>
          </thead>
          <tbody>
            {attendances.map((attendance) => (
              <tr key={attendance.id} className="border-b">
                <td className="px-4 py-2">{attendance.date}</td>
                <td className="px-4 py-2">{attendance.time}</td>
                <td className="px-4 py-2">{attendance.class}</td>
                <td className="px-4 py-2">{attendance.name}</td>
                <td className="px-4 py-2">{attendance.nisn}</td>
                <td className="px-4 py-2">
                  {attendance.photo ? (
                    <img
                      src={attendance.photo}
                      alt="Foto siswa"
                      className="w-12 h-12 object-cover rounded-full border-2 border-gray-300"
                    />
                  ) : (
                    <span className="text-gray-500">Tidak ada foto</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDataPage = () => (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Data Absensi</h2>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Memuat data...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700">
            <thead className="text-xs uppercase bg-gray-200">
              <tr>
                <th className="px-4 py-2">Tanggal</th>
                <th className="px-4 py-2">Jam</th>
                <th className="px-4 py-2">Kelas</th>
                <th className="px-4 py-2">Nama</th>
                <th className="px-4 py-2">NISN</th>
                <th className="px-4 py-2">Foto</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Tidak ada data absensi
                  </td>
                </tr>
              ) : (
                attendanceData.map((attendance, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{attendance.date}</td>
                    <td className="px-4 py-2">{attendance.time}</td>
                    <td className="px-4 py-2">{attendance.class}</td>
                    <td className="px-4 py-2">{attendance.name}</td>
                    <td className="px-4 py-2">{attendance.nisn}</td>
                    <td className="px-4 py-2">
                      {attendance.photo &&
                      attendance.photo.startsWith("https://") ? (
                        <a
                          href={attendance.photo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          Lihat Foto
                        </a>
                      ) : attendance.photo ? (
                        <img
                          src={attendance.photo}
                          alt="Foto siswa"
                          className="w-12 h-12 object-cover rounded-full border-2 border-gray-300"
                        />
                      ) : (
                        <span className="text-gray-500">Tidak ada foto</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          attendance.status === "Hadir"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {attendance.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderStudentsPage = () => (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Data Siswa</h2>
        <button
          onClick={() => {
            setStudentForm({
              nisn: "",
              name: "",
              class: "",
              error: "",
              loading: false,
            });
            setShowAddModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
        >
          Tambah Siswa
        </button>
      </div>

      {studentForm.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
          {studentForm.error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-700">
          <thead className="text-xs uppercase bg-gray-200">
            <tr>
              <th className="px-4 py-2">NISN</th>
              <th className="px-4 py-2">Nama</th>
              <th className="px-4 py-2">Kelas</th>
              <th className="px-4 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {studentData.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Tidak ada data siswa
                </td>
              </tr>
            ) : (
              studentData.map((student, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{student.nisn}</td>
                  <td className="px-4 py-2">{student.name}</td>
                  <td className="px-4 py-2">{student.class}</td>
                  <td className="px-4 py-2 flex space-x-2">
                    <button
                      onClick={() => {
                        setEditStudent(student);
                        setStudentForm({
                          nisn: student.nisn,
                          name: student.name,
                          class: student.class,
                          error: "",
                          loading: false,
                        });
                        setShowEditModal(true);
                      }}
                      className="bg-yellow-600 text-white px-3 py-1 rounded-lg hover:bg-yellow-700 transition duration-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDeleteStudentNisn(student.nisn);
                        setShowDeleteModal(true);
                      }}
                      className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition duration-200"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Tambah Siswa</h2>
            <div className="space-y-4">
              <input
                type="text"
                name="nisn"
                value={studentForm.nisn}
                onChange={handleStudentInputChange}
                placeholder="NISN"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                name="name"
                value={studentForm.name}
                onChange={handleStudentInputChange}
                placeholder="Nama"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                name="class"
                value={studentForm.class}
                onChange={handleStudentInputChange}
                placeholder="Kelas"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {studentForm.error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg">
                  {studentForm.error}
                </div>
              )}
              <div className="flex space-x-2">
                <button
                  onClick={handleAddStudent}
                  disabled={studentForm.loading}
                  className="flex-1 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
                >
                  {studentForm.loading ? "⏳ Menyimpan..." : "Simpan"}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Edit Siswa</h2>
            <div className="space-y-4">
              <input
                type="text"
                name="nisn"
                value={studentForm.nisn}
                onChange={handleStudentInputChange}
                placeholder="NISN"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                name="name"
                value={studentForm.name}
                onChange={handleStudentInputChange}
                placeholder="Nama"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                name="class"
                value={studentForm.class}
                onChange={handleStudentInputChange}
                placeholder="Kelas"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {studentForm.error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg">
                  {studentForm.error}
                </div>
              )}
              <div className="flex space-x-2">
                <button
                  onClick={handleEditStudent}
                  disabled={studentForm.loading}
                  className="flex-1 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
                >
                  {studentForm.loading ? "⏳ Memperbarui..." : "Perbarui"}
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditStudent(null);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Konfirmasi Hapus</h2>
            <p className="mb-4">
              Apakah Anda yakin ingin menghapus data siswa ini?
            </p>
            {studentForm.error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg mb-4">
                {studentForm.error}
              </div>
            )}
            <div className="flex space-x-2">
              <button
                onClick={handleDeleteStudent}
                disabled={studentForm.loading}
                className="flex-1 bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition duration-200 disabled:opacity-50"
              >
                {studentForm.loading ? "⏳ Menghapus..." : "Hapus"}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-4xl sm:mx-auto w-full max-w-4xl mx-auto px-4">
        <h1 className="text-center text-2xl font-semibold text-gray-900 mb-6">
          Aplikasi Absensi Siswa
        </h1>

        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg shadow-lg p-1 flex">
            <button
              onClick={() => handlePageChange("form")}
              className={`px-6 py-2 rounded-md transition duration-200 ${
                currentPage === "form"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              📝 Form Absensi
            </button>
            <button
              onClick={() => handlePageChange("data")}
              className={`px-6 py-2 rounded-md transition duration-200 ${
                currentPage === "data"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              📊 Data Absensi
            </button>
            <button
              onClick={() => handlePageChange("students")}
              className={`px-6 py-2 rounded-md transition duration-200 ${
                currentPage === "students"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              👥 Data Siswa
            </button>
          </div>
        </div>

        {currentPage === "form"
          ? renderFormPage()
          : currentPage === "data"
          ? renderDataPage()
          : renderStudentsPage()}
      </div>
    </div>
  );
};

export default App;
