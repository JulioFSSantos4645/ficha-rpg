# VTT de Call of Cthulhu (7ª Edição)

Uma ficha digital e interativa de investigador para **Call of Cthulhu (7ª Edição)**, desenvolvida para rodar localmente em Node.js e facilitar partidas presenciais ou online. O sistema permite gerenciar atributos, marcadores de vida, magia, sorte e sanidade, controlar perícias, armas e inventário, além de contar com um rolador de dados integrado e layout responsivo para acesso pelo celular na mesma rede Wi-Fi (LAN), ou por VPN.

> **Aviso:** Este é um projeto não oficial feito por fã, sem fins comerciais e sem qualquer vínculo, endosso ou afiliação com a Chaosium Inc. ou os detentores dos direitos de *Call of Cthulhu*. Nenhuma arte, texto ou material protegido dos livros oficiais está incluído neste repositório.

# Como executar o projeto

## Pré-requisitos

Antes de começar, instale o **Node.js** pelo terminal usando o comando correspondente ao seu sistema operacional:

- **Windows:**
  ```bash
  winget install OpenJS.NodeJS.LTS
  ```

- **macOS (via Homebrew):**
  ```bash
  brew install node
  ```

- **Linux (Ubuntu / Debian):**
  ```bash
  sudo apt update && sudo apt install -y nodejs
  ```

> **Dica:** Após a instalação, feche e abra o terminal novamente e digite `node -v` para confirmar que deu certo. *(Caso prefira baixar o instalador manualmente, acesse [nodejs.org](https://nodejs.org/).)*

---

## Passo a passo

1. **Baixe os arquivos** deste repositório e coloque todos eles dentro de uma mesma pasta.
2. **Abra o terminal** e navegue até a pasta onde você salvou os arquivos:

```bash
cd caminho/da/sua/pasta
```

3. **Inicie o servidor** executando o comando abaixo:

```bash
node server.js --lan
```

---

## Como acessar

Depois de iniciar o servidor, o terminal exibirá o endereço e a porta em que ele está rodando (por exemplo, `3000` ou `8080`). Abra o navegador e acesse:

- **No mesmo computador:**
  ```text
  http://localhost:PORTA
  ```
- **Em outros dispositivos na mesma rede Wi-Fi / LAN ou VPN** (celular, tablet ou outro PC):
  ```text
  http://SEU-IP-LOCAL:PORTA
  ```

> **Dica:** Substitua `PORTA` pelo número exibido no terminal e `SEU-IP-LOCAL` pelo endereço IP do computador que está rodando o servidor (ex.: `http://192.168.1.10:3000`).

---

# Imagens da Ficha

## Aba do Investigador
  <img width="1919" height="1079" alt="Captura de tela 2026-11-19 170703" src="https://github.com/user-attachments/assets/2f96da51-1c5c-4052-a62b-17bffdef676b" />

## Aba de Perícias e com Histórico de Rolagens
  <img width="1919" height="1079" alt="Captura de tela 2026-11-19 170801" src="https://github.com/user-attachments/assets/63bdbe17-579d-4e67-920e-ff94069114f4" />

## Aba de Combate e Inventário
  <img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/0a37e129-e71c-4cd1-bb02-5f8771063081" />

## No Celular
  <img width="360" height="800" alt="Captura de tela 2026-11-19 170936" src="https://github.com/user-attachments/assets/e588ddf1-7a08-4a80-b179-a2fa2ff66dc7" />
