using CatanServer.Hubs;
using CatanServer.Services;

var builder = WebApplication.CreateBuilder(args);

const string ClientCorsPolicy = "ClientCorsPolicy";

// Vite dev server origins. SignalR sends credentials, so origins must be listed
// explicitly - AllowAnyOrigin is incompatible with AllowCredentials.
string[] clientOrigins =
[
    "http://localhost:5173",
    "http://127.0.0.1:5173"
];

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddSignalR();

// Single shared board held in memory for the whole process.
builder.Services.AddSingleton<IGameStateService, GameStateService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy(ClientCorsPolicy, policy => policy
        .WithOrigins(clientOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// CORS must run before routing to endpoints, and before authorization.
app.UseCors(ClientCorsPolicy);

app.UseAuthorization();

app.MapControllers();
app.MapHub<GameHub>(GameHub.Route);

app.Run();
