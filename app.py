import os
import re
import io
import zipfile
from datetime import datetime, timedelta
from flask import Flask, render_template, request, send_file, jsonify
import pandas as pd
from PIL import Image, ImageDraw, ImageFont

app = Flask(__name__)
app.secret_key = "comsoc_cia_c_3de_key"

# --- CONFIGURAÇÕES DE DATAS ---
MESES_EXTENSO = {
    1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
    7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
}

def obter_meses_alvo():
    hoje = datetime.now()
    mes_atual_num = hoje.month
    ano_atual = hoje.year
    data_prox = (hoje.replace(day=1) + timedelta(days=32)).replace(day=1)
    mes_prox_num = data_prox.month
    ano_prox = data_prox.year
    
    return {
        "atual": {"num": mes_atual_num, "nome": MESES_EXTENSO[mes_atual_num], "ano": ano_atual},
        "proximo": {"num": mes_prox_num, "nome": MESES_EXTENSO[mes_prox_num], "ano": ano_prox}
    }

# --- ENGINE DE PROCESSAMENTO VISUAL ---
def formatar_nome_proprio(texto):
    texto = str(texto).strip().lower()
    conectores = ["de", "da", "do", "das", "dos", "e"]
    palavras = texto.split()
    return " ".join([p if p in conectores and i != 0 else p.capitalize() for i, p in enumerate(palavras)])

def desenhar_identidade_visual(draw, largura_img, y, posto, nome_completo, nome_guerra):
    nome_exibicao = formatar_nome_proprio(nome_completo)
    nome_guerra_limpo = str(nome_guerra).strip().upper()
    
    parte_para_negrito = re.search(r"([A-Z]{3,})", nome_guerra_limpo)
    alvo_negrito = parte_para_negrito.group(1) if parte_para_negrito else nome_guerra_limpo

    f_reg_path = "static/fontes/cambria.ttc"
    f_neg_path = "static/fontes/cambriab.ttf"

    try:
        f_reg = ImageFont.truetype(f_reg_path, 72)
        f_neg = ImageFont.truetype(f_neg_path, 72)
    except:
        f_reg = f_neg = ImageFont.load_default()

    mascara_negrito = [0] * len(nome_exibicao)
    for m in re.finditer(r"\b" + re.escape(alvo_negrito) + r"\b", nome_exibicao.upper()):
        for i in range(m.start(), m.end()): mascara_negrito[i] = 1

    w_posto = draw.textlength(f"{posto} ", font=f_neg)
    largura_nome = sum([draw.textlength(l, font=(f_neg if mascara_negrito[i] else f_reg)) for i, l in enumerate(nome_exibicao)])
    x_atual = (largura_img - (w_posto + largura_nome)) / 2

    draw.text((x_atual, y), f"{posto} ", font=f_neg, fill=(0, 0, 0))
    x_atual += w_posto
    for i, letra in enumerate(nome_exibicao):
        f = f_neg if mascara_negrito[i] else f_reg
        draw.text((x_atual, y), letra, font=f, fill=(0, 0, 0))
        x_atual += draw.textlength(letra, font=f)

def processar_cartao(template_img, linha, mes_num, ano_ref):
    img = template_img.copy()
    draw = ImageDraw.Draw(img)
    
    desenhar_identidade_visual(draw, img.size[0], 550, 
                               linha.get("PGRAD", ""), 
                               linha.get("NOME", ""), 
                               linha.get("NOME_GUERRA", ""))
    
    dia = int(linha["DT_NASCIMENTO"].day)
    nome_mes = MESES_EXTENSO[mes_num]
    txt_data = f"Santa Maria, RS, {dia} de {nome_mes.lower()} de {ano_ref}"
    
    try:
        f_data = ImageFont.truetype("static/fontes/cambria.ttc", 55)
    except:
        f_data = ImageFont.load_default()
        
    w_data = draw.textbbox((0, 0), txt_data, font=f_data)[2]
    limite_X = 2100 if len(nome_mes) > 7 else (2130 if len(nome_mes) > 5 else 2160)
    draw.text((limite_X - w_data, 1160), txt_data, font=f_data, fill=(0, 0, 0))
    return img

def gerar_pdf_impressao(lista_imagens):
    if not lista_imagens:
        return None
    
    largura_a4, altura_a4 = 2480, 3508 
    paginas = []
    
    for i in range(0, len(lista_imagens), 2):
        folha = Image.new("RGB", (largura_a4, altura_a4), (255, 255, 255))
        par = lista_imagens[i:i+2]
        
        for idx, cartao in enumerate(par):
            largura_max = largura_a4 - 200
            proporcao = largura_max / cartao.width
            nova_altura = int(cartao.height * proporcao)
            cartao_res = cartao.resize((largura_max, nova_altura), Image.Resampling.LANCZOS)
            
            x_offset = (largura_a4 - largura_max) // 2
            y_offset = 200 if idx == 0 else (altura_a4 // 2) + 100
            folha.paste(cartao_res, (x_offset, y_offset))
            
        paginas.append(folha)
    
    pdf_io = io.BytesIO()
    paginas[0].save(pdf_io, format="PDF", save_all=True, append_images=paginas[1:])
    pdf_io.seek(0)
    return pdf_io

# --- ROTAS ---
@app.route("/")
def index():
    meses = obter_meses_alvo()
    return render_template("index.html", meses=meses)

@app.route("/api/analisar_planilha", methods=["POST"])
def analisar_planilha():
    file_excel = request.files.get("excel")
    mes_alvo = int(request.form.get("mes_alvo"))

    if not file_excel:
        return jsonify({"erro": "Nenhum arquivo enviado"}), 400

    try:
        df = pd.read_excel(file_excel)
        df.columns = [str(c).strip().upper() for c in df.columns]
        df["DT_NASCIMENTO"] = pd.to_datetime(df["DT_NASCIMENTO"], errors="coerce")
        df = df.dropna(subset=["DT_NASCIMENTO"])
        
        # AJUSTE DA ORDENAÇÃO: Ordena especificamente pelo DIA do mês
        anivs = df[df["DT_NASCIMENTO"].dt.month == mes_alvo].copy()
        anivs = anivs.sort_values(by="DT_NASCIMENTO", key=lambda x: x.dt.day)
        
        militar_list = []
        for _, row in anivs.iterrows():
            militar_list.append({
                "dia": int(row["DT_NASCIMENTO"].day),
                "pgrad": str(row.get("PGRAD", "")),
                "nome": formatar_nome_proprio(row.get("NOME", ""))
            })
            
        return jsonify({"militares": militar_list})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@app.route("/gerar", methods=["POST"])
def gerar():
    file_excel = request.files.get("excel")
    file_template = request.files.get("template")
    mes_selecionado = int(request.form.get("mes_selecionado"))
    ano_selecionado = int(request.form.get("ano_selecionado"))

    if not file_excel or not file_template:
        return "⚠️ Erro: Envie ambos os arquivos.", 400

    try:
        df = pd.read_excel(file_excel)
        df.columns = [str(c).strip().upper() for c in df.columns]
        df["DT_NASCIMENTO"] = pd.to_datetime(df["DT_NASCIMENTO"], errors="coerce")
        df = df.dropna(subset=["DT_NASCIMENTO"])
        
        # AJUSTE DA ORDENAÇÃO: Garante que o PDF e as imagens sigam a ordem dos DIAS
        anivs = df[df["DT_NASCIMENTO"].dt.month == mes_selecionado].copy()
        anivs = anivs.sort_values(by="DT_NASCIMENTO", key=lambda x: x.dt.day)
        
        if anivs.empty:
            return "Nenhum aniversariante encontrado.", 404

        template_img = Image.open(file_template).convert("RGB")
        zip_buffer = io.BytesIO()
        lista_imagens_processadas = []

        with zipfile.ZipFile(zip_buffer, "w") as zf:
            for _, row in anivs.iterrows():
                img_final = processar_cartao(template_img, row, mes_selecionado, ano_selecionado)
                lista_imagens_processadas.append(img_final)
                
                img_byte_arr = io.BytesIO()
                img_final.save(img_byte_arr, format="JPEG", quality=95)
                
                dia_aniv = int(row["DT_NASCIMENTO"].day)
                guerra = str(row.get("NOME_GUERRA", "MILITAR")).replace(" ", "_").upper()
                nome_arquivo = f"{dia_aniv:02d}_{guerra}.jpg"
                zf.writestr(f"imagens/{nome_arquivo}", img_byte_arr.getvalue())

            pdf_buffer = gerar_pdf_impressao(lista_imagens_processadas)
            if pdf_buffer:
                zf.writestr(f"IMPRIMIR_{MESES_EXTENSO[mes_selecionado].upper()}.pdf", pdf_buffer.getvalue())

        zip_buffer.seek(0)
        return send_file(zip_buffer, mimetype="application/zip", as_attachment=True, 
                         download_name=f"Cartoes_{MESES_EXTENSO[mes_selecionado]}.zip")
    except Exception as e:
        return f"Erro: {str(e)}", 500

if __name__ == "__main__":
    app.run(debug=True)