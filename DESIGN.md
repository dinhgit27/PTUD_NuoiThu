# DESIGN.md — OfficePet Pixel Sanctuary (Awesome-Design-MD Standard)

> Inspired by [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md): disciplined visual hierarchy, zero decorative icon/emoji bloat, intentional spatial separation, and tactile retro-modern craftsmanship.

---

## 1. Core Design Philosophy

1. **Zero Decorative Icon Clutter**:
   - Do not prefix every button, label, or tab with emojis or decorative icons.
   - Rely on clean, high-contrast typography, consistent padding, and tactile borders (`2px solid #0f172a`) for hierarchy and scannability.
2. **Pure Pet Room Sanctuary (Left Column — 7 Cols)**:
   - The pet room is strictly for the **Pet** and its **Environment**.
   - No floating HUD cards, no overlay menus, no floating emotion bars, and no footer metadata inside the room canvas.
   - The pet roams and performs animations freely inside an unobstructed habitat.
3. **Interactive EXP Liquid Tank & Action Console (Right Column — 5 Cols)**:
   - **Top Card — Liquid EXP Tank (`Bể chứa EXP`) & Level Up (`Thăng cấp`)**:
     - A vertical glass vessel whose liquid height (`0%` – `100%`) dynamically reflects `pet.exp / nextLevelExp`.
     - Low EXP shows a shallow pool at the bottom; high EXP fills the cylinder with golden energy.
     - Directly paired with the **Thăng cấp** button to evolve the pet once the tank is full.
   - **Bottom Card — Balanced Action & Expression Grid (`Hành động & Biểu cảm`)**:
     - Positioned directly beneath the EXP tank.
     - 16 text-only buttons in a uniform grid (`h-10`), equal width, zero badge clutter, immediate visual feedback on active state.
