# ocr-shopping-list

## Local Dev
### ENV Variables
When running the `dev` script, use `.env` files to supply required config.

Place a `.env.development` file in the `/ocr-shopping-list-vite` directory, with the following:
- `VITE_OpenAI_Api_Key`: API Key generated in the OpenAI API Platform.

### NGROK
To test over the internet using NGROK, the vite config needs to be updated to allow NGROK's host.

Add the following to `vite.config.js`:

```js
server: {
	hmr: {
		clientPort: 443,
	},
	allowedHosts: [
		".ngrok-free.app"
	]
},
```


## Plugins
Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh


## Expanding the ESLint configuration
If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


