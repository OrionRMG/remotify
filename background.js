////////////////////////////////////// Authorization //////////////////////////////////////
chrome.runtime.onMessage.addListener(async (request) => {
  console.log(request);

  const TOKEN = "https://accounts.spotify.com/api/token";
  const clientId = "5c30cb62f3654b588234f18c7eeca29d";
  const redirectUri = chrome.identity.getRedirectURL("spotify");

  async function refreshAccessToken() {
    const refresh_token_obj = await chrome.storage.local.get(["refresh_token"]);
    const refresh_token = refresh_token_obj.refresh_token;

    let body =
      "grant_type=refresh_token" +
      "&refresh_token=" +
      refresh_token +
      "&client_id=" +
      clientId;

    console.log(body);
    await callAuthorizationApi(body);
    console.log("Refreshed access token.");
  }

  // Get Access Token using authorization code
  async function callAuthorizationApi(body) {
    let response = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    console.log(response);
    if (response.ok) {
      const jsonResponse = await response.json();
      handleAuthorizationResponse(response, jsonResponse);
    } else {
      throw new Error(
        `Request failed! Status code: ${response.status} ${response.statusText}`
      );
    }
  }

  // Store access and refresh tokens
  async function handleAuthorizationResponse(response, jsonResponse) {
    if (response.status == 200) {
      if (jsonResponse.access_token != undefined) {
        console.log("Access token saved.");
        access_token = jsonResponse.access_token;
        await chrome.storage.local.set({ access_token });
      }
      if (jsonResponse.refresh_token != undefined) {
        refresh_token = jsonResponse.refresh_token;
        await chrome.storage.local.set({ refresh_token });
      }
      chrome.runtime.sendMessage("REFRESH");
    }
  }

  if (request === "REFRESH ACCESS TOKEN") {
    console.log("test");
    refreshAccessToken();
  } else if (request === "GET ACCESS TOKEN") {
    const codeVerifierObj = await chrome.storage.local.get(["code_verifier"]);
    const codeVerifier = await codeVerifierObj.code_verifier;

    function generateRandomString(length) {
      let text = "";
      let possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

      for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
      }
      return text;
    }

    async function generateCodeChallenge() {
      function base64encode(string) {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(string)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
      }

      const digestObj = await chrome.storage.session.get(["digest"]);
      const digest = digestObj.digest;

      console.log(digest);

      return base64encode(digest);
    }

    // let codeVerifier = generateRandomString(128);

    let WebAuthFlowDetails = {};
    let args;

    await generateCodeChallenge().then((codeChallenge) => {
      let state = generateRandomString(16);
      let scope =
        "user-read-playback-state user-modify-playback-state user-read-currently-playing streaming";

      args = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        scope: scope,
        redirect_uri: redirectUri,
        state: state,
        code_challenge_method: "S256",
        code_challenge: codeChallenge,
      });

      WebAuthFlowDetails = {
        interactive: true,
        url: `https://accounts.spotify.com/authorize?${args}`,
      };
    });

    // Request authorization code
    async function getCode(url) {
      let code = null;
      const parsedURL = new URL(url);
      const queryString = parsedURL.search;
      const urlParams = new URLSearchParams(queryString);
      code = await urlParams.get("code");
      await fetchAccessToken(code);
    }

    async function fetchAccessToken(code) {
      let codeVerifier = "";
      await chrome.storage.local.get(["code_verifier"]).then((result) => {
        codeVerifier = result.code_verifier;
      });

      let body = new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      });

      console.log(body.get("grant_type"));
      console.log(body.get("code"));
      console.log(body.get("redirect_uri"));
      console.log(body.get("client_id"));
      console.log(body.get("code_verifier"));

      await callAuthorizationApi(body);
    }

    const resUrl = await chrome.identity.launchWebAuthFlow(WebAuthFlowDetails);

    const code = getCode(resUrl);

    fetchAccessToken(code);
  }
});
