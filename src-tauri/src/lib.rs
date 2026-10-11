use tauri::Manager;

mod activity;
mod keepass;
mod remote;
mod servers;
mod settings;
mod util;
mod cloudflared;

use activity::commands::{
    activity_add_event,
    activity_get_events,
    activity_get_stats,
    activity_get_chart_data,
    activity_cleanup_old_events,
    activity_export_events,
};

use keepass::commands::{
    keepass_change_password,
    keepass_close,
    keepass_create,
    keepass_create_group,
    keepass_delete_entry,
    keepass_delete_group,
    keepass_get_entry,
    keepass_list_entries,
    keepass_list_files,
    keepass_list_groups,
    keepass_open,
    keepass_save_entry,
};

use cloudflared::commands::{
    check_cloudflared_version,
    start_tcp_tunnel,
    stop_tcp_tunnel,
    install_cloudflared,
    get_latest_cloudflared_version,
};

use util::get_platform_info;

pub const UI_READY_EVENT: &str = "ui-ready";
pub const MAIN_WINDOW_ID: &str = "main";
pub const KEYRING_SERVICE: &str = env!("CARGO_PKG_NAME");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
    let runtime_handle = tokio::runtime::Handle::current();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::new().skip_logger().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            let window = app.get_webview_window(MAIN_WINDOW_ID).unwrap();
            if !window.is_visible().unwrap() {
                window.show().unwrap();
            }
            window.set_focus().unwrap();
        }))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(util::make_reqwest());
            app.manage(runtime_handle);

            activity::setup(app.handle())?;
            settings::setup(app.handle())?;
            keepass::setup(app.handle())?;
            servers::setup(app.handle())?;
            remote::setup(app.handle())?;
            cloudflared::setup(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            activity_add_event,
            activity_get_events,
            activity_get_stats,
            activity_get_chart_data,
            activity_cleanup_old_events,
            activity_export_events,
            settings::update_settings,
            settings::patch_settings,
            servers::toggle_company_expansion,
            servers::load_service_credential,
            servers::add_server,
            servers::update_server,
            servers::delete_server,
            servers::add_service,
            servers::update_service,
            servers::delete_service,
            servers::get_service,
            remote::connect_rdp_service_with_credentials,
            remote::connect_ssh_service_with_credentials,
            remote::connect_service,
            remote::disconnect_service,
            // KeePass commands
            keepass_list_files,
            keepass_create,
            keepass_open,
            keepass_close,
            keepass_list_groups,
            keepass_list_entries,
            keepass_get_entry,
            keepass_save_entry,
            keepass_delete_entry,
            keepass_create_group,
            keepass_delete_group,
            keepass_change_password,
            get_platform_info,
            // Cloudflared commands
            check_cloudflared_version,
            start_tcp_tunnel,
            stop_tcp_tunnel,
            install_cloudflared,
            get_latest_cloudflared_version,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(move |_app_handle, event| {
        if matches!(
            event,
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
        ) {
            /*
            TODO: handle gracefull exit etc.
            */
        }
    });
}
