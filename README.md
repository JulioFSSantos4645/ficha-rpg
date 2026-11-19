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
- **Em outros dispositivos na mesma rede Wi-Fi / LAN** (celular, tablet ou outro PC):
  ```text
  http://SEU-IP-LOCAL:PORTA
  ```

> **Dica:** Substitua `PORTA` pelo número exibido no terminal e `SEU-IP-LOCAL` pelo endereço IP do computador que está rodando o servidor (ex.: `http://192.168.1.10:3000`).
