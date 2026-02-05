namespace HLE.FileServer.Models;

public class StorageSettings
{
    public string UserFilesPath { get; set; } = "./data/uploads";
    public string GroupFilesPath { get; set; } = "./data/group_files";
}
