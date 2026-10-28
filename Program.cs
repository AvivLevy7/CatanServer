using CatanServer.Hubs;
using CatanServer.Services;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

const string ClientCorsPolicy = "ClientCorsPolicy";

// SignalR sends credentials, so origins must be listed explicitly - AllowAnyOrigin is
// incompatible with AllowCredentials. Production origins come from the ALLOWED_ORIGINS
// environment variable (comma/semicolon separated, e.g. "https://catan.example.com");
// the Vite dev server origins are always included so local development keeps working.
string[] clientOrigins =
[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    .. (Environment.GetEnvironmentVariable("ALLOWED_ORIGINS") ?? string.Empty)
        .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(origin => origin.TrimEnd('/'))
];

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddSignalR();

// One RoomManager for the process; each room owns its own GameStateService.
builder.Services.AddSingleton<RoomManager>();
// Per-room turn clocks (AFK protection); needs IHubContext so it must be a singleton.
builder.Services.AddSingleton<TurnTimerService>();
// Computer players; drives bot seats off the same game service and broadcasts.
builder.Services.AddSingleton<AiBotService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy(ClientCorsPolicy, policy => policy
        .WithOrigins(clientOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

var app = builder.Build();

// Eagerly create the bot service so it is listening for timer events from the first game.
app.Services.GetRequiredService<AiBotService>();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Behind a PaaS reverse proxy (Render/Railway/Azure) TLS terminates at the edge and the
// container only sees plain HTTP. Honour X-Forwarded-* so the app knows the real scheme,
// and never redirect to HTTPS inside the container (there is no HTTPS listener there).
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// CORS must run before routing to endpoints, and before authorization.
app.UseCors(ClientCorsPolicy);

app.UseAuthorization();

app.MapControllers();
app.MapHub<GameHub>(GameHub.Route);
// Liveness probe for container platforms.
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
