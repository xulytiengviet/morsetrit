# MorseTrit Lab

Trang thử nghiệm mã hóa **tiếng Việt → CVNSS4.0 → A–Z + SPACE → Base27 → 3 trít (000–222) → mô phỏng driver → giải mã ngược**.

**Demo dự kiến khi bật GitHub Pages:** https://xulytiengviet.github.io/morsetrit/

## Giao diện Bento (09/11/2026)

Giao diện dựa trên `bento.html` do người phát triển cung cấp, gồm nền kem `#f2f0ed`, chữ đen xanh `#1b211e`, điểm nhấn tím `#5944b5`, ô tím nhạt `#c8b9ff`, thẻ bo tròn và bố cục bất đối xứng 2:1.

- `index.html`: bố cục bento gồm ô tiêu đề, ô toán học `27 = 3³`, ô CVNSS4.0 và ô mô phỏng sáu kênh.
- `bento-theme.css`: lớp giao diện sáng bổ sung; được nạp sau `style.css` để giữ các hiệu ứng tín hiệu gốc.
- Toàn bộ encoder, driver, các ví dụ, trường trít nhận và decoder giữ nguyên API và cách hoạt động.
- Bố cục responsive: desktop dùng lưới không đối xứng, tablet và mobile sắp xếp lại từng ô.

**Lưu ý:** Trang sẽ được cập nhật công khai khi GitHub Pages đã bật để phát hành nhánh `main` từ thư mục `/(root)`.

## Sử dụng

1. Mở trang `index.html` trong trình duyệt (hoặc dùng GitHub Pages).
2. Nhập tiếng Việt, chọn **Mã hóa tín hiệu** và kiểm tra bốn bước trong pipeline.
3. Chọn một trong sáu chế độ **RGB, đèn giao thông, độ sáng, Morse tam phân, Ternary FSK, rung**.
4. Chọn **Phát tín hiệu**. Trình duyệt phát âm FSK qua Web Audio API; chế độ rung phụ thuộc hỗ trợ của thiết bị.
5. Sửa dãy trít tại **Receiver** rồi chọn **Giải mã ngược**. Dùng **Gây lỗi 1 trít** để kiểm tra trường hợp luồng thay đổi.

Trang tĩnh, không dùng máy chủ, tài khoản, framework hoặc CDN. Trình duyệt giữ dữ liệu trong bộ nhớ phiên; không gửi văn bản lên server.

## Kiến trúc

| Tệp | Vai trò |
|---|---|
| `index.html` | Giao diện phòng thí nghiệm; chú thích khoa học |
| `style.css` | CSS responsive; mô phỏng màu/đèn/xung/dao động |
| `app.js` | Điều khiển UI, phát Web Audio FSK, vibration và giải mã tương tác |
| `codec.js` | API có thể kiểm thử: ánh xạ Base27 ↔ trít, xác thực luồng, so sánh round-trip |
| `cvnss-converter.js` | Bản nguyên gốc *CVNSS4.0 v5.0.0-audit-safe* do người tạo dự án cung cấp |
| `tests/codec.test.cjs` | Kiểm thử Node.js không dùng thư viện ngoài |

### Giao thức Base27

Bảng mã: `SPACE=0, A=1, ..., Z=26`.

Với mỗi giá trị \(v\), tính \(t_2=\lfloor v/9\rfloor\), \(t_1=\lfloor (v\bmod 9)/3\rfloor\), \(t_0=v\bmod 3\).

Ba trít `t2 t1 t0` biểu diễn \(v=9t_2+3t_1+t_0\).

- `SPACE` → 0 → `000`
- `A` → 1 → `001`
- `Z` → 26 → `222`

**27 = 3³** nên 27/27 tổ hợp trít được sử dụng, không có từ mã Base27 bị bỏ trống. Với 5 bit nhị phân có 32 tổ hợp và 5/32 tổ hợp không dùng (15,625%). Đây chỉ là **hiệu suất sử dụng không gian từ mã**, **không** chứng minh CVNSS4.0 hoặc đường truyền có độ chính xác 100%, cũng không chứng minh nén tốt hơn toàn cục.

### Kênh mô phỏng

| Chế độ | 0 | 1 | 2 | Giới hạn |
|---|---|---|---|---|
| RGB | Đỏ | Lục | Lam | Hiển thị trực quan; chưa có cảm biến màu |
| Đèn giao thông | Đỏ | Vàng | Xanh | Mô phỏng, không điều khiển đèn thực |
| Độ sáng | Thấp | Vừa | Cao | Chưa hiệu chuẩn đo sáng |
| Morse tam phân | 150 ms | 300 ms | 500 ms | Bộ mã xung tự định nghĩa, không phải Morse ITU |
| Ternary FSK | 600 Hz | 1000 Hz | 1400 Hz | Chỉ phát âm, chưa thu/móc đồng bộ/đánh giá BER |
| Rung | 100 ms | 200 ms | 400 ms | Phụ thuộc Vibration API và thiết bị |

Trên kênh vật lý thật cần thêm **preamble, symbol clock recovery, frame delimiter, checksum/CRC, chống nhiễu và kiểm thử tỷ lệ lỗi bit/trít**. Trang hiện tại là trình phát và giải mã luồng **số**; chưa giải điều chế từ microphone/camera/accelerometer.

### Giới hạn dữ liệu

Bộ mã hóa **báo lỗi** thay vì tự xóa các ký tự ngoài A–Z + SPACE. Dấu câu, số, emoji và các ký tự chưa được ánh xạ muốn truyền cần bổ sung giao thức thoát ký tự hoặc cơ chế framing riêng.

Đầu vào được chuẩn hóa NFC và khoảng trắng. Base27 hiện không mã hóa kiểu chữ hoa/thường của văn bản gốc: khi giải mã có thể trả về chữ thường. Mức **khớp bỏ phân biệt hoa/thường** được hiển thị riêng với **khớp chính xác**.

Bộ chuyển đổi được dùng đúng bản **5.0.0-audit-safe**: 758 dòng gốc, 336 mục vá, 56 nhóm nhập nhằng, 5 nhóm va chạm trọng yếu và self-test 23 ca. Một số biểu diễn CVNSS4.0 ánh xạ nhiều–một, do đó cần quy tắc chọn dạng chuẩn; **không thể kết luận 99,9% độ chính xác** khi chưa đánh giá trên tập dữ liệu đại diện.

## Kiểm thử

Yêu cầu Node.js ≥ 18:

```bash
node --test tests/codec.test.cjs
```

Gồm kiểm thử 27 giá trị, các ví dụ tiếng Việt, nhập nhằng, lỗi định dạng, và thay đổi một trít.

## Bật GitHub Pages

Trong GitHub mở **Settings → Pages → Build and deployment → Deploy from a branch**. Chọn **main**, thư mục **/(root)** rồi **Save**. Khi Pages triển khai xong, mở URL demo ở đầu README.

## Nguồn và ghi nhận

- Dự án thử nghiệm: [xulytiengviet/morsetrit](https://github.com/xulytiengviet/morsetrit).
- CVNSS4.0: chuyển đổi chữ tiếng Việt, có lịch sử quy tắc và tác giả riêng. Tệp `cvnss-converter.js` được bảo tồn từ bản người dùng cung cấp; vui lòng kiểm tra quyền sử dụng và ghi công nguồn gốc khi tái phân phối.
- Demo phục vụ đào tạo, nghiên cứu, đánh giá giải pháp tam phân. Không dùng cho liên lạc cứu hộ thực tế hay điều khiển an toàn trọng yếu nếu chưa có chứng nhận và kiểm thử phù hợp.
