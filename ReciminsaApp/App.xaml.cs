namespace ReciminsaApp;

public partial class App : Application
{
	public App()
	{
		// Set WebView2 user data folder to LocalApplicationData to avoid C:\Program Files permission issues on Windows
		var userDataFolder = System.IO.Path.Combine(System.Environment.GetFolderPath(System.Environment.SpecialFolder.LocalApplicationData), "ReciminsaApp", "WebView2");
		System.Environment.SetEnvironmentVariable("WEBVIEW2_USER_DATA_FOLDER", userDataFolder);

		InitializeComponent();
	}

	protected override Window CreateWindow(IActivationState? activationState)
	{
		return new Window(new MainPage());
	}
}
