import os
import sys
import re
import pandas as pd
import customtkinter as ctk
import tkinter as tk
from PIL import Image, ImageDraw, ImageFont, ImageTk
from tkinter import messagebox, filedialog
from datetime import datetime, timedelta

ctk.set_appearance_mode("dark")

# --- SUPORTE DE DIRETÓRIO ---
def obter_diretorio_base():
    if getattr(sys, "frozen", False): return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

def obter_caminho(nome_arquivo):
    return os.path.join(obter_diretorio_base(), nome_arquivo)

class AppComSocMaster(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Sistema ComSoc Cia C/3ª DE - v18.1")
        self.geometry("1300x900")

        # --- ESTADO DO SISTEMA ---
        self.path_template_aniv = obter_caminho("template.jpg")
        self.font_reg = obter_caminho("cambria.ttc")
        self.font_neg = obter_caminho("cambriab.ttf")
        self.path_planilha = None
        self.df_militares = None
        
        # Datas de Referência
        self.hoje = datetime.now()
        self.mes_atual = self.hoje.month
        data_prox = (self.hoje.replace(day=1) + timedelta(days=32)).replace(day=1)
        self.mes_prox = data_prox.month
        self.ano_ref = data_prox.year
        
        self.meses_extenso = {1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho", 
                             7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"}

        self.setup_ui()
        self.carregar_planilha_auto()

    # ==========================================
    # ENGINE DE DESENHO
    # ==========================================
    def formatar_nome_proprio(self, texto):
        texto = str(texto).strip().lower()
        conectores = ["de", "da", "do", "das", "dos", "e"]
        palavras = texto.split()
        return " ".join([p if p in conectores and i != 0 else p.capitalize() for i, p in enumerate(palavras)])

    def desenhar_identidade_visual(self, draw, largura_img, y, posto, nome_completo, nome_guerra):
        nome_exibicao = self.formatar_nome_proprio(nome_completo)
        nome_guerra_limpo = str(nome_guerra).strip().upper()
        partes_guerra = re.findall(r"\w+", nome_guerra_limpo) 
        mascara_negrito = [0] * len(nome_exibicao)
        
        f_reg = ImageFont.truetype(self.font_reg, 70)
        f_neg = ImageFont.truetype(self.font_neg, 70)

        for parte in partes_guerra:
            for m in re.finditer(r"\b" + re.escape(partes_guerra[0]) + r"\b", nome_exibicao.upper()):
                for i in range(m.start(), m.end()): mascara_negrito[i] = 1

        w_posto = draw.textbbox((0, 0), f"{posto} ", font=f_neg)[2]
        largura_nome = sum([draw.textlength(l, font=(f_neg if mascara_negrito[i] else f_reg)) for i, l in enumerate(nome_exibicao)])
        x_atual = (largura_img - (w_posto + largura_nome)) / 2

        draw.text((x_atual, y), f"{posto} ", font=f_neg, fill=(0, 0, 0))
        x_atual += w_posto
        for i, letra in enumerate(nome_exibicao):
            f = f_neg if mascara_negrito[i] else f_reg
            draw.text((x_atual, y), letra, font=f, fill=(0, 0, 0))
            x_atual += draw.textlength(letra, font=f)

    def processar_cartao(self, img, linha):
        draw = ImageDraw.Draw(img)
        self.desenhar_identidade_visual(draw, img.size[0], 550, linha.get("PGRAD", ""), linha.get("NOME", ""), linha.get("NOME_GUERRA", ""))
        
        dia = int(linha["DT_NASCIMENTO"].day)
        nome_mes = self.meses_extenso[self.mes_prox]
        txt_data = f"Santa Maria, RS, {dia} de {nome_mes.lower()} de {self.ano_ref}"
        
        f_data = ImageFont.truetype(self.font_reg, 55)
        w_data = draw.textbbox((0, 0), txt_data, font=f_data)[2]
        limite_X = 2100 if len(nome_mes) > 7 else (2130 if len(nome_mes) > 5 else 2160)
        draw.text((limite_X - w_data, 1160), txt_data, font=f_data, fill=(0, 0, 0))
        return img

    # ==========================================
    # INTERFACE E FLUXO DE PDF
    # ==========================================
    def setup_ui(self):
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self.sidebar = ctk.CTkFrame(self, width=220, corner_radius=0, fg_color="#1a1a1a")
        self.sidebar.grid(row=0, column=0, sticky="nsew")
        ctk.CTkLabel(self.sidebar, text="EB - COMSOC", font=("Arial", 20, "bold")).pack(pady=30)

        self.tabs = {}
        # Removido "Criar Cartão" da lista de abas
        for name in ["Início", "Aniversariantes", "Configurações"]:
            btn = ctk.CTkButton(self.sidebar, text=name, anchor="w", command=lambda n=name: self.select_tab(n))
            btn.pack(fill="x", padx=10, pady=5)
            self.tabs[name] = ctk.CTkFrame(self, fg_color="transparent")

        self.setup_inicio()
        self.setup_aniversariantes()
        self.setup_config()
        self.select_tab("Início")

    def select_tab(self, name):
        for t in self.tabs.values(): t.grid_forget()
        self.tabs[name].grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        if name == "Aniversariantes": self.atualizar_aba_aniversariantes()

    def setup_inicio(self):
        tab = self.tabs["Início"]
        ctk.CTkLabel(tab, text="Sistema ComSoc Cia C/3ª DE", font=("Arial", 28, "bold")).pack(pady=(10, 0))
        self.lbl_sub = ctk.CTkLabel(tab, text=f"{self.meses_extenso[self.mes_prox]} de {self.ano_ref}", font=("Arial", 18))
        self.lbl_sub.pack(pady=(0, 20))

        self.preview_scroll = ctk.CTkScrollableFrame(tab, fg_color="#121212")
        self.preview_scroll.pack(fill="both", expand=True, padx=10, pady=10)
        
        ctk.CTkButton(tab, text="GERAR PASTA E PDF DE IMPRESSÃO", fg_color="#27ae60", 
                      command=self.fluxo_geracao_final, height=50, font=("Arial", 14, "bold")).pack(fill="x", padx=10, pady=10)

    def previsualizar_inicio(self):
        for w in self.preview_scroll.winfo_children(): w.destroy()
        if self.df_militares is None: return
        anivs = self.df_militares[self.df_militares["DT_NASCIMENTO"].dt.month == self.mes_prox].copy()
        anivs["dia"] = anivs["DT_NASCIMENTO"].dt.day
        anivs = anivs.sort_values("dia")
        
        template = Image.open(self.path_template_aniv).convert("RGB")
        for _, row in anivs.iterrows():
            img_p = template.copy()
            self.processar_cartao(img_p, row)
            img_p.thumbnail((800, 500))
            ph = ImageTk.PhotoImage(img_p)
            lbl = ctk.CTkLabel(self.preview_scroll, image=ph, text="")
            lbl.image = ph
            lbl.pack(pady=10)

    def fluxo_geracao_final(self):
        if self.df_militares is None: 
            messagebox.showwarning("Aviso", "Carregue a planilha antes de gerar.")
            return
            
        base_path = filedialog.askdirectory(title="Selecione o local para salvar")
        if not base_path: return

        p_cards = os.path.join(base_path, "Cartoes_Aniversariantes")
        os.makedirs(p_cards, exist_ok=True)

        anivs = self.df_militares[self.df_militares["DT_NASCIMENTO"].dt.month == self.mes_prox].copy().sort_values(by="DT_NASCIMENTO")
        
        if anivs.empty:
            messagebox.showinfo("Aviso", "Nenhum aniversariante encontrado para este mês.")
            return

        cartoes_pil = []
        template_base = Image.open(self.path_template_aniv).convert("RGB")

        for _, linha in anivs.iterrows():
            img = template_base.copy()
            self.processar_cartao(img, linha)
            dia = int(linha["DT_NASCIMENTO"].day)
            nome_guerra = str(linha.get("NOME_GUERRA", "SemNome")).replace(" ", "_")
            img.save(os.path.join(p_cards, f"{dia:02d}_{nome_guerra}.jpg"), quality=95)
            cartoes_pil.append(img)

        paginas_pdf = []
        for i in range(0, len(cartoes_pil), 2):
            w, h = cartoes_pil[i].size
            folha = Image.new("RGB", (w, (h * 2) + 100), (255, 255, 255))
            folha.paste(cartoes_pil[i], (0, 0))
            if i + 1 < len(cartoes_pil):
                folha.paste(cartoes_pil[i+1], (0, h + 100))
            paginas_pdf.append(folha)

        if paginas_pdf:
            caminho_pdf = os.path.join(base_path, f"Modelo_Impressao_{self.meses_extenso[self.mes_prox]}.pdf")
            paginas_pdf[0].save(caminho_pdf, save_all=True, append_images=paginas_pdf[1:], resolution=100.0, quality=95)

        messagebox.showinfo("Sucesso", f"Arquivos gerados com sucesso em:\n{base_path}")
        os.startfile(base_path)

    def setup_aniversariantes(self):
        tab = self.tabs["Aniversariantes"]
        ctk.CTkButton(tab, text="Copiar para WhatsApp", command=self.copiar_lista_whatsapp).pack(pady=5, anchor="e")
        self.txt_aniv = ctk.CTkTextbox(tab, font=("Consolas", 15))
        self.txt_aniv.pack(fill="both", expand=True, pady=10)

    def atualizar_aba_aniversariantes(self):
        if self.df_militares is None: return
        texto = ""
        for m in [self.mes_atual, self.mes_prox]:
            anivs = self.df_militares[self.df_militares["DT_NASCIMENTO"].dt.month == m].copy()
            anivs["dia"] = anivs["DT_NASCIMENTO"].dt.day
            anivs = anivs.sort_values("dia")
            texto += f"--- ANIVERSARIANTES DE {self.meses_extenso[m].upper()} ---\n"
            for _, r in anivs.iterrows():
                texto += f"[{int(r['dia']):02d}] {r.get('PGRAD','')} {r.get('NOME_GUERRA','')}\n"
            texto += "\n"
        self.txt_aniv.delete("1.0", "end")
        self.txt_aniv.insert("1.0", texto)

    def copiar_lista_whatsapp(self):
        self.clipboard_clear()
        self.clipboard_append(self.txt_aniv.get("1.0", "end"))
        messagebox.showinfo("Copiado", "Área de transferência atualizada!")

    def setup_config(self):
        tab = self.tabs["Configurações"]
        ctk.CTkLabel(tab, text="Configurações", font=("Arial", 20, "bold")).pack(pady=20)
        ctk.CTkButton(tab, text="Trocar Template", command=self.mudar_template_sistema).pack(pady=10)
        ctk.CTkButton(tab, text="Trocar Planilha", command=self.mudar_planilha_sistema).pack(pady=10)
        self.lbl_status = ctk.CTkLabel(tab, text="Verificando...", text_color="gray"); self.lbl_status.pack(pady=20)

    def mudar_template_sistema(self):
        f = filedialog.askopenfilename(filetypes=[("Imagens", "*.jpg")])
        if f: 
            self.path_template_aniv = f
            self.previsualizar_inicio()

    def mudar_planilha_sistema(self):
        f = filedialog.askopenfilename(filetypes=[("Excel", "*.xlsx *.csv")])
        if f: 
            self.path_planilha = f
            self.carregar_planilha_especifica(f)

    def carregar_planilha_auto(self):
        dir_b = obter_diretorio_base()
        files = [f for f in os.listdir(dir_b) if f.lower().startswith("militares")]
        if files: self.carregar_planilha_especifica(os.path.join(dir_b, files[0]))

    def carregar_planilha_especifica(self, path):
        try:
            self.df_militares = pd.read_csv(path) if path.endswith(".csv") else pd.read_excel(path)
            self.df_militares.columns = [str(c).strip().upper() for c in self.df_militares.columns]
            self.df_militares["DT_NASCIMENTO"] = pd.to_datetime(self.df_militares["DT_NASCIMENTO"], dayfirst=True, errors="coerce")
            self.lbl_status.configure(text=f"Ativo: {os.path.basename(path)}", text_color="white")
            self.previsualizar_inicio()
        except Exception as e: messagebox.showerror("Erro", f"Planilha: {e}")

if __name__ == "__main__":
    AppComSocMaster().mainloop()